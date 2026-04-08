import type { PrismaClient } from "@prisma/client";
import { ClaimDraftLineSource } from "@prisma/client";

import {
  BUILD_AI_PROMPT_VERSION,
  buildAiMissingRateFallbackCents,
  buildAiOpenAiModel,
} from "@/lib/build/build-ai-env";
import { fetchBuildAiCodeSuggestions } from "@/lib/build/build-ai-openai";
import { logBuildDraftEvent } from "@/lib/build/draft-event-log";
import { resolveSyntheticChargeCents } from "@/lib/build/fee-schedule-lookup";
import { normalizeCpt } from "@/lib/build/retrieval";
import { syncClaimDraftRuleIssues } from "@/lib/build/sync-draft-rules";

export type SuggestDraftResult =
  | { ok: true; draftId: string; runId: string; lineCount: number }
  | { ok: false; error: string };

function encounterPayload(enc: {
  dateOfService: Date;
  chiefComplaint: string | null;
  visitSummary: string;
  placeOfService: string | null;
  visitType: string | null;
  assessment: string | null;
  providerSpecialty: string | null;
  patient: { firstName: string; lastName: string; mrn: string | null; dob: Date | null };
}) {
  return {
    dateOfService: enc.dateOfService.toISOString().slice(0, 10),
    chiefComplaint: enc.chiefComplaint,
    visitSummary: enc.visitSummary,
    placeOfService: enc.placeOfService,
    visitType: enc.visitType,
    assessment: enc.assessment,
    providerSpecialty: enc.providerSpecialty,
    patient: {
      firstName: enc.patient.firstName,
      lastName: enc.patient.lastName,
      mrn: enc.patient.mrn,
      ageHint: enc.patient.dob
        ? `DOB ${enc.patient.dob.toISOString().slice(0, 10)}`
        : null,
    },
  };
}

export async function suggestDraftFromEncounter(args: {
  db: PrismaClient;
  tenantId: string;
  orgSlug: string;
  encounterId: string;
  actorUserId: string;
}): Promise<SuggestDraftResult> {
  const enc = await args.db.encounter.findFirst({
    where: { id: args.encounterId, tenantId: args.tenantId },
    include: { patient: true },
  });
  if (!enc) return { ok: false, error: "Encounter not found." };

  let draft = await args.db.claimDraft.findFirst({
    where: { encounterId: enc.id, tenantId: args.tenantId },
    orderBy: { id: "desc" },
  });

  if (!draft) {
    draft = await args.db.claimDraft.create({
      data: {
        tenantId: args.tenantId,
        encounterId: enc.id,
        status: "draft",
      },
    });
  }

  const ai = await fetchBuildAiCodeSuggestions({
    userPayload: encounterPayload(enc),
  });

  if (!ai.ok) {
    await args.db.buildSuggestionRun.create({
      data: {
        tenantId: args.tenantId,
        encounterId: enc.id,
        draftId: draft.id,
        model: buildAiOpenAiModel(),
        promptVersion: BUILD_AI_PROMPT_VERSION,
        status: "failed",
        errorMessage: ai.error,
        actorUserId: args.actorUserId,
      },
    });
    return { ok: false, error: ai.error };
  }

  await args.db.$transaction(async (tx) => {
    await tx.claimDraftLine.deleteMany({ where: { draftId: draft!.id } });
    await tx.claimIssue.deleteMany({ where: { draftId: draft!.id } });

    let responseJson: object;
    try {
      responseJson = JSON.parse(ai.rawJson) as object;
    } catch {
      responseJson = { unparsed: ai.rawJson };
    }

    const run = await tx.buildSuggestionRun.create({
      data: {
        tenantId: args.tenantId,
        encounterId: enc.id,
        draftId: draft!.id,
        model: buildAiOpenAiModel(),
        promptVersion: BUILD_AI_PROMPT_VERSION,
        status: "completed",
        rawResponseJson: responseJson,
        actorUserId: args.actorUserId,
      },
    });

    for (let i = 0; i < ai.lines.length; i++) {
      const row = ai.lines[i];
      const cptNorm = normalizeCpt(row.cpt).replace(/[^A-Z0-9]/g, "");
      const cpt = (cptNorm.length ? cptNorm.slice(0, 5) : null) || "99213";
      const pos = enc.placeOfService?.trim() || null;
      let { chargeCents, rateId } = await resolveSyntheticChargeCents(tx, {
        tenantId: args.tenantId,
        cpt,
        placeOfService: pos,
      });
      if (chargeCents <= 0) {
        chargeCents = buildAiMissingRateFallbackCents();
        rateId = null;
      }

      const draftLine = await tx.claimDraftLine.create({
        data: {
          draftId: draft!.id,
          cpt,
          icd10: row.icd10.trim(),
          modifier: row.modifier,
          units: row.units,
          chargeCents,
          aiRationale: row.rationale,
          icd10Descriptor: row.icd10Descriptor,
          cptDescriptor: row.cptDescriptor,
          lineSource: ClaimDraftLineSource.AI_SUGGESTION,
        },
      });

      await tx.buildSuggestionLine.create({
        data: {
          runId: run.id,
          ordinal: i,
          icd10: row.icd10.trim(),
          cpt,
          modifier: row.modifier,
          units: row.units,
          rationale: row.rationale,
          icd10Descriptor: row.icd10Descriptor,
          cptDescriptor: row.cptDescriptor,
          feeScheduleRateId: rateId,
          chargeCentsApplied: chargeCents,
          claimDraftLineId: draftLine.id,
          reviewStatus: "pending",
        },
      });
    }

    await logBuildDraftEvent(tx, {
      tenantId: args.tenantId,
      draftId: draft!.id,
      eventType: "ai_suggestion_applied",
      payload: {
        runId: run.id,
        lineCount: ai.lines.length,
        promptVersion: BUILD_AI_PROMPT_VERSION,
      },
      actorUserId: args.actorUserId,
    });
  });

  await syncClaimDraftRuleIssues(args.db, {
    tenantId: args.tenantId,
    draftId: draft.id,
  });

  const run = await args.db.buildSuggestionRun.findFirst({
    where: { draftId: draft.id },
    orderBy: { createdAt: "desc" },
  });

  return {
    ok: true,
    draftId: draft.id,
    runId: run?.id ?? "",
    lineCount: ai.lines.length,
  };
}

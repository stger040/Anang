"use server";

import { logBuildDraftEvent } from "@/lib/build/draft-event-log";
import {
  assemble837pProfessional,
  tradingPartnerFor837pFromTenant,
} from "@/lib/connect/edi/assemble-837p";
import {
  validateX12Structure,
  type X12ValidationResult,
} from "@/lib/connect/edi/validate-x12-structure";
import { tenantPrisma } from "@/lib/prisma";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

function numericControlSeed(id: string, salt: string): number {
  let h = 0;
  const s = id + salt;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export async function approveClaimDraft(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const draftId = String(formData.get("draftId") ?? "");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  if (!draftId || !orgSlug) throw new Error("Invalid payload");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.BUILD)) {
    throw new Error("Forbidden");
  }

  const draft = await tenantPrisma(orgSlug).claimDraft.findFirst({
    where: { id: draftId, tenantId: ctx.tenant.id },
    include: { encounter: true },
  });
  if (!draft) throw new Error("Draft not found");

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).$transaction(async (tx) => {
    await tx.claimDraft.update({
      where: { id: draftId },
      data: {
        status: "ready",
        approvedAt: new Date(),
        approvedById: session.userId,
      },
    });
    await tx.encounter.update({
      where: { id: draft.encounterId },
      data: { reviewStatus: "approved" },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: ctx.tenant.id,
        actorUserId: session.userId,
        action: "build.draft.approved",
        resource: "claim_draft",
        metadata: { draftId, ...(requestId ? { requestId } : {}) },
      },
    });
    await logBuildDraftEvent(tx, {
      tenantId: ctx.tenant.id,
      draftId,
      eventType: "draft_approved",
      actorUserId: session.userId,
      payload: {
        encounterId: draft.encounterId,
        ...(requestId ? { requestId } : {}),
      },
    });
  });

  revalidatePath(`/o/${orgSlug}/build`, "page");
  revalidatePath(`/o/${orgSlug}/build/encounters/${draft.encounterId}`, "page");
}

export async function preview837pFromDraft(formData: FormData): Promise<
  | { ok: true; x12: string; structuralValidation: X12ValidationResult }
  | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const draftId = String(formData.get("draftId") ?? "");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  if (!draftId || !orgSlug) return { ok: false, error: "Invalid payload" };

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.BUILD)) {
    return { ok: false, error: "Forbidden" };
  }

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { id: ctx.tenant.id } });
  if (!tenant) return { ok: false, error: "Tenant not found" };

  const draft = await tenantPrisma(orgSlug).claimDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id },
    include: {
      encounter: { include: { patient: true } },
      lines: { orderBy: { id: "asc" } },
    },
  });
  if (!draft) return { ok: false, error: "Draft not found" };

  if (draft.lines.length === 0) {
    return {
      ok: false,
      error: "Draft has no lines — add charge lines before preview.",
    };
  }

  const coverages = await tenantPrisma(orgSlug).coverage.findMany({
    where: {
      patientId: draft.encounter.patientId,
      tenantId: tenant.id,
    },
    orderBy: { priority: "asc" },
  });
  const primaryCov =
    coverages.find((c) => c.priority === "primary") ?? coverages[0] ?? null;

  const rawSettings =
    tenant.settings && typeof tenant.settings === "object"
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const implementation = parseImplementationSettings(
    rawSettings.implementation,
  );
  const tp = tradingPartnerFor837pFromTenant(
    implementation?.tradingPartnerEnrollment,
    { orgName: tenant.displayName },
  );

  const claimControlNumber = `DRAFT-${draft.id.replace(/\W/g, "").slice(-12)}`;
  const seedIsa = numericControlSeed(draft.id, "isa");
  const seedGs = numericControlSeed(draft.id, "gs");
  const seedSt = numericControlSeed(draft.id, "st");

  try {
    const x12 = assemble837pProfessional({
      now: new Date(),
      claimControlNumber,
      controls: {
        isa13: String((seedIsa % 999_999_999) + 1).padStart(9, "0"),
        gs06: String((seedGs % 99_999_999) + 1),
        st02: String((seedSt % 9999) + 1).padStart(4, "0"),
      },
      tradingPartner: tp,
      patient: {
        firstName: draft.encounter.patient.firstName,
        lastName: draft.encounter.patient.lastName,
        mrn: draft.encounter.patient.mrn,
        dob: draft.encounter.patient.dob,
      },
      encounter: { dateOfService: draft.encounter.dateOfService },
      lines: draft.lines.map((l) => ({
        cpt: l.cpt,
        icd10: l.icd10,
        modifier: l.modifier,
        units: l.units,
        chargeCents: l.chargeCents,
      })),
      primaryCoverage: primaryCov
        ? { payerName: primaryCov.payerName, memberId: primaryCov.memberId }
        : null,
    });
    const structuralValidation = validateX12Structure(x12, {
      expect837Professional: true,
    });
    return { ok: true, x12, structuralValidation };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assembly failed";
    return { ok: false, error: message };
  }
}

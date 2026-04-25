"use server";

import {
  greenwayFhirGetResource,
  summarizeFhirPatientResource,
  resolveGreenwayFhirEnvConfigAsyncForTenant,
  syncGreenwayPatientEncounters,
} from "@/lib/connectors/greenway-fhir";
import { GREENWAY_FHIR_HUB_SYNC_AUDIT_ACTION } from "@/lib/connectors/greenway-fhir/audit-actions";
import { normalizeCsvEncounterStatementUpload } from "@/lib/connectors/csv-fixture-import";
import {
  PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH,
  persistPatientEncounterImport,
} from "@/lib/connectors/persist-patient-encounter-import";
import { parseBuildRulePackConfig } from "@/lib/build/rule-pack-config";
import { normalizeCpt, normalizeIcd10 } from "@/lib/build/retrieval";
import { tenantPrisma } from "@/lib/prisma";
import { normalizeFhirBundlePayload } from "@/lib/fhir-fixture-import";
import {
  BILLING_DISCOVERY_ITEMS,
  IT_EHR_WORKSTREAM_ITEMS,
  type OnboardingCheckState,
} from "@/lib/onboarding-checklists";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { isTenantSettingsEditor } from "@/lib/tenant-admin-guard";
import {
  DEFAULT_PRIOR_AUTH_HIGH_RISK,
  defaultPriorAuthImplementationSettings,
  type PriorAuthImplementationSettingsV1,
  type PriorAuthSignalCategoryKey,
} from "@/lib/prior-auth/defaults";
import { mergeImplementationFromForm } from "@/lib/tenant-implementation-settings";
import { readTradingPartnerEnrollmentFromForm } from "@/lib/trading-partner-enrollment";
import { platformLog, readRequestIdFromHeaders } from "@/lib/platform-log";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { ModuleKey } from "@prisma/client";

export type SettingsActionState =
  | { error: string }
  | {
      ok: true;
      payStatementCreated?: boolean;
      /** R4 EOB resources matched on import (audit / visitSummary only; not 835). */
      fhirEobResourceCount?: number;
      /** New Build encounter row (always present on successful FHIR import). */
      importedEncounterId?: string;
      /** New Pay statement when PAY is entitled (same transaction as encounter). */
      importedStatementId?: string;
    }
  | null;

function readBillingChecks(formData: FormData): OnboardingCheckState {
  const s: OnboardingCheckState = {};
  for (const { id } of BILLING_DISCOVERY_ITEMS) {
    s[id] = formData.get(`b:${id}`) === "on";
  }
  return s;
}

function readItChecks(formData: FormData): OnboardingCheckState {
  const s: OnboardingCheckState = {};
  for (const { id } of IT_EHR_WORKSTREAM_ITEMS) {
    s[id] = formData.get(`i:${id}`) === "on";
  }
  return s;
}

function readPriorAuthFromForm(formData: FormData): PriorAuthImplementationSettingsV1 {
  const base = defaultPriorAuthImplementationSettings();
  const num = (k: string, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : d;
  };
  const categoriesSubmitted = formData.get("pa_categories_submitted") === "on";
  const defaultHighRiskCategories: PriorAuthSignalCategoryKey[] = [];
  for (const k of DEFAULT_PRIOR_AUTH_HIGH_RISK) {
    if (formData.get(`pa_cat_${k}`) === "on") {
      defaultHighRiskCategories.push(k);
    }
  }
  const reworkRaw = String(formData.get("pa_rework_fields") ?? "").trim();
  const reworkTrackingFields = reworkRaw
    ? reworkRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : base.reworkTrackingFields;
  return {
    ...base,
    enabled: formData.get("pa_enabled") === "on",
    unknownPlanBehavior:
      formData.get("pa_unknown_plan") === "proceed_low_risk"
        ? "proceed_low_risk"
        : "review_required",
    defaultHighRiskCategories: categoriesSubmitted
      ? defaultHighRiskCategories
      : base.defaultHighRiskCategories,
    intakeStartHours: num("pa_intake_hours", base.intakeStartHours),
    standardDecisionSlaDays: num("pa_std_sla_days", base.standardDecisionSlaDays),
    expeditedDecisionSlaHours: num("pa_exp_sla_hours", base.expeditedDecisionSlaHours),
    followUpIntervalHours: num("pa_followup_hours", base.followUpIntervalHours),
    expiringSoonDays: num("pa_expiring_days", base.expiringSoonDays),
    reworkTrackingFields,
    laborRateCentsPerHour: (() => {
      const raw = String(formData.get("pa_labor_rate_cents") ?? "").trim();
      if (!raw) return null;
      const v = Number(raw);
      return Number.isFinite(v) ? Math.round(v) : null;
    })(),
  };
}

export async function saveImplementationProgress(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return { error: "Only tenant admins or platform super admins can update this." };
  }

  const rawSettings =
    (await tenantPrisma(orgSlug).tenant.findUnique({ where: { id: ctx.tenant.id } }))
      ?.settings ?? {};
  const base =
    rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings)
      ? (rawSettings as Record<string, unknown>)
      : {};

  const milestoneNotes = String(formData.get("milestoneNotes") ?? "").trim();
  const ehrVendor = String(formData.get("ehrVendor") ?? "").trim();
  const integrationPattern = String(formData.get("integrationPattern") ?? "").trim();
  const itName = String(formData.get("contact_it_name") ?? "").trim();
  const itEmail = String(formData.get("contact_it_email") ?? "").trim();
  const billingLeadName = String(
    formData.get("contact_billing_name") ?? "",
  ).trim();
  const billingLeadEmail = String(
    formData.get("contact_billing_email") ?? "",
  ).trim();

  const tradingPartnerEnrollment =
    readTradingPartnerEnrollmentFromForm(formData);

  const implementation = mergeImplementationFromForm({
    existing: base.implementation,
    milestoneNotes,
    ehrVendor,
    integrationPattern,
    contacts: {
      itName: itName || undefined,
      itEmail: itEmail || undefined,
      billingLeadName: billingLeadName || undefined,
      billingLeadEmail: billingLeadEmail || undefined,
    },
    billing: readBillingChecks(formData),
    it: readItChecks(formData),
    tradingPartnerEnrollment,
    priorAuth: readPriorAuthFromForm(formData),
  });

  await tenantPrisma(orgSlug).tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      settings: {
        ...base,
        implementation,
      },
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "settings.implementation.saved",
      resource: "tenant",
      metadata: {
        billingDone: Object.values(implementation.checklist?.billing ?? {}).filter(
          Boolean,
        ).length,
        itDone: Object.values(implementation.checklist?.it ?? {}).filter(Boolean)
          .length,
        tradingPartnerEnrollmentSaved: Boolean(
          implementation.tradingPartnerEnrollment,
        ),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  revalidatePath(`/o/${orgSlug}/settings`);
  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  return { ok: true };
}

export type BuildRulePackActionState =
  | { error: string }
  | { ok: true }
  | null;

export async function saveBuildRulePack(
  _prev: BuildRulePackActionState,
  formData: FormData,
): Promise<BuildRulePackActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  if (!ctx.enabledModules.has(ModuleKey.BUILD)) {
    return { error: "Build module is not enabled for this tenant." };
  }

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return { error: "Only tenant admins or platform super admins can update this." };
  }

  const jsonText = String(formData.get("buildRulePackJson") ?? "").trim();
  let parsed: unknown = {};
  if (jsonText.length > 0) {
    try {
      parsed = JSON.parse(jsonText) as unknown;
    } catch {
      return { error: "Rule pack must be valid JSON." };
    }
  }

  const cfg = parseBuildRulePackConfig(parsed);
  if (!cfg.ok) return { error: cfg.error };

  await tenantPrisma(orgSlug).buildRulePack.upsert({
    where: { tenantId: ctx.tenant.id },
    create: {
      tenantId: ctx.tenant.id,
      config: cfg.config as Prisma.InputJsonValue,
    },
    update: { config: cfg.config as Prisma.InputJsonValue },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "settings.build_rule_pack.saved",
      resource: "build_rule_pack",
      metadata: {
        disabledCount: cfg.config.disabledRuleKeys?.length ?? 0,
        overrideCount: cfg.config.severityOverrides
          ? Object.keys(cfg.config.severityOverrides).length
          : 0,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  platformLog("info", "settings.build_rule_pack.saved", {
    tenantId: ctx.tenant.id,
    orgSlug,
    ...(requestId ? { requestId } : {}),
  });
  return { ok: true };
}

export type BuildKnowledgeChunkActionState =
  | { error: string }
  | { ok: true }
  | null;

export async function upsertBuildKnowledgeChunk(
  _prev: BuildKnowledgeChunkActionState,
  formData: FormData,
): Promise<BuildKnowledgeChunkActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  if (!ctx.enabledModules.has(ModuleKey.BUILD)) {
    return { error: "Build module is not enabled for this tenant." };
  }

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error: "Only tenant admins or platform super admins can update this.",
    };
  }

  const kindRaw = String(formData.get("kind") ?? "").trim().toLowerCase();
  if (kindRaw !== "cpt" && kindRaw !== "icd10") {
    return { error: "Kind must be cpt or icd10." };
  }

  const lookupRaw = String(formData.get("lookupKey") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const sourceLabel = String(formData.get("sourceLabel") ?? "").trim();

  const lookupKey =
    kindRaw === "cpt" ? normalizeCpt(lookupRaw) : normalizeIcd10(lookupRaw);
  if (!lookupKey) {
    return { error: "CPT or ICD-10 code is required." };
  }
  if (!title) return { error: "Title is required." };
  if (!body) return { error: "Body / reference text is required." };

  await tenantPrisma(orgSlug).buildKnowledgeChunk.upsert({
    where: {
      tenantId_kind_lookupKey: {
        tenantId: ctx.tenant.id,
        kind: kindRaw,
        lookupKey,
      },
    },
    create: {
      tenantId: ctx.tenant.id,
      kind: kindRaw,
      lookupKey,
      title,
      body,
      sourceLabel: sourceLabel || null,
    },
    update: {
      title,
      body,
      sourceLabel: sourceLabel || null,
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "settings.build_knowledge_chunk.upserted",
      resource: "build_knowledge_chunk",
      metadata: {
        kind: kindRaw,
        lookupKey,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  platformLog("info", "settings.build_knowledge_chunk.upserted", {
    tenantId: ctx.tenant.id,
    orgSlug,
    kind: kindRaw,
    lookupKey,
    ...(requestId ? { requestId } : {}),
  });
  return { ok: true };
}

export async function deleteBuildKnowledgeChunk(
  _prev: BuildKnowledgeChunkActionState,
  formData: FormData,
): Promise<BuildKnowledgeChunkActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const chunkId = String(formData.get("chunkId") ?? "").trim();
  if (!chunkId) return { error: "Missing chunk id." };

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  if (!ctx.enabledModules.has(ModuleKey.BUILD)) {
    return { error: "Build module is not enabled for this tenant." };
  }

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error: "Only tenant admins or platform super admins can update this.",
    };
  }

  const deleted = await tenantPrisma(orgSlug).buildKnowledgeChunk.deleteMany({
    where: { id: chunkId, tenantId: ctx.tenant.id },
  });

  if (deleted.count === 0) {
    return { error: "Chunk not found or already removed." };
  }

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "settings.build_knowledge_chunk.deleted",
      resource: "build_knowledge_chunk",
      metadata: {
        chunkId,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  platformLog("info", "settings.build_knowledge_chunk.deleted", {
    tenantId: ctx.tenant.id,
    orgSlug,
    chunkId,
    ...(requestId ? { requestId } : {}),
  });
  return { ok: true };
}

export async function importFhirFixtureFromSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return { error: "Only tenant admins or platform super admins can import fixtures." };
  }

  if (!ctx.enabledModules.has(ModuleKey.BUILD)) {
    return {
      error:
        "Turn on the Build module for this tenant to load encounters (or use seed data only).",
    };
  }

  const jsonText = String(formData.get("bundleJson") ?? "");
  const requestId = await readRequestIdFromHeaders();
  const normalized = normalizeFhirBundlePayload(jsonText);
  if (!normalized.ok) {
    return { error: normalized.error };
  }
  const d = normalized.data;
  const payEnabled = ctx.enabledModules.has(ModuleKey.PAY);
  /** Default statement total when the bundle has no billable R4 Claim lines. */
  const stubStatementCents = 25_000;
  const claimLines = d.claimStatement?.lines ?? [];
  const fromClaim = payEnabled && claimLines.length > 0;
  const statementTotalCents = fromClaim
    ? claimLines.reduce((s, x) => s + x.amountCents, 0)
    : stubStatementCents;

  let payStatementCreated = false;
  let statementIdForAudit: string | undefined;
  let encounterIdForResult: string | undefined;
  let idempotentPatient = false;
  let idempotentEncounter = false;
  let statementReplaced = false;
  let sourceArtifactMeta:
    | {
        id: string;
        sha256Hex: string;
        byteLength: number;
        inlineStored: boolean;
        externalStored: boolean;
        storageUri: string | null;
      }
    | undefined;

  try {
    const txResult = await persistPatientEncounterImport(tenantPrisma(orgSlug), {
      tenantId: ctx.tenant.id,
      payEnabled,
      normalized: d,
      rawText: jsonText,
      connectorKind: "fhir_fixture",
      sourceKind: "fhir_r4_bundle_json",
      ingestMetadata: {
        path: "settings.import",
        ...(requestId ? { requestId } : {}),
      },
      claimLines,
      fromClaim,
      statementTotalCents,
      stubStatementCents,
      stubLineDescription:
        "Balance from FHIR import when no Claim lines were importable",
      statementNumberOverride: null,
    });

    encounterIdForResult = txResult.encounterId;
    statementIdForAudit = txResult.statementId;
    payStatementCreated = txResult.payStatementCreated;
    idempotentPatient = txResult.idempotentPatient;
    idempotentEncounter = txResult.idempotentEncounter;
    statementReplaced = txResult.statementReplaced;
    sourceArtifactMeta = txResult.sourceArtifactMeta;
  } catch (e) {
    console.error(e);
    if (
      e instanceof Error &&
      e.message === PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH
    ) {
      return {
        error:
          "This import’s encounter key is already linked to a different patient in this tenant. Fix the file or clear the conflicting import in the database.",
      };
    }
    return { error: "Database error while saving patient / encounter." };
  }

  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "integration.fhir_fixture.imported",
      resource: "patient_encounter",
      metadata: {
        mrn: d.mrn,
        patientName: `${d.lastName}, ${d.firstName}`,
        fhirIdempotentPatient: idempotentPatient,
        fhirIdempotentEncounter: idempotentEncounter,
        ...(sourceArtifactMeta
          ? {
              sourceArtifactId: sourceArtifactMeta.id,
              sourceArtifactSha256: sourceArtifactMeta.sha256Hex,
              sourceArtifactBytes: sourceArtifactMeta.byteLength,
              sourceArtifactInlineStored: sourceArtifactMeta.inlineStored,
              sourceArtifactExternalStored: sourceArtifactMeta.externalStored,
              ...(sourceArtifactMeta.storageUri
                ? { sourceArtifactStorageUri: sourceArtifactMeta.storageUri }
                : {}),
            }
          : {}),
        ...(payStatementCreated ? { fhirStatementLinesReplaced: statementReplaced } : {}),
        ...(encounterIdForResult ? { encounterId: encounterIdForResult } : {}),
        payStatementCreated,
        ...(statementIdForAudit ? { statementId: statementIdForAudit } : {}),
        ...(payStatementCreated
          ? {
              statementBalanceCents: statementTotalCents,
              statementSource: fromClaim ? "fhir_r4_claim" : "fhir_bundle_fallback_line",
              ...(fromClaim && d.claimStatement
                ? {
                    fhirClaimCount: d.claimStatement.claimResourceCount,
                    ...(d.claimStatement.claimIds.length > 0
                      ? { fhirClaimIds: d.claimStatement.claimIds }
                      : {}),
                    ...(d.claimStatement.claimLogicalId
                      ? { fhirClaimId: d.claimStatement.claimLogicalId }
                      : {}),
                    ...(d.claimStatement.fhirFx
                      ? {
                          fhirFxSkippedLines:
                            d.claimStatement.fhirFx.skippedLineCount,
                          fhirFxUsedBuiltin:
                            d.claimStatement.fhirFx.usedBuiltinRates,
                          fhirFxUsedEnv: d.claimStatement.fhirFx.usedEnvRates,
                        }
                      : {}),
                  }
                : {}),
            }
          : {}),
        ...(d.explanationOfBenefit
          ? {
              fhirEobResourceCount: d.explanationOfBenefit.resourceCount,
              ...(d.explanationOfBenefit.logicalIds.length > 0
                ? { fhirEobIds: d.explanationOfBenefit.logicalIds }
                : {}),
              ...(d.explanationOfBenefit.linkedClaimIds.length > 0
                ? { fhirEobLinkedClaimIds: d.explanationOfBenefit.linkedClaimIds }
                : {}),
              ...(d.explanationOfBenefit.outcomes.length > 0
                ? { fhirEobOutcomes: d.explanationOfBenefit.outcomes }
                : {}),
            }
          : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "integration.fhir_fixture.import_ok", {
    tenantId: ctx.tenant.id,
    orgSlug,
    payStatementCreated,
    fromClaim,
    fhirIdempotentPatient: idempotentPatient,
    fhirIdempotentEncounter: idempotentEncounter,
    ...(sourceArtifactMeta
      ? {
          sourceArtifactSha256: sourceArtifactMeta.sha256Hex,
          sourceArtifactInlineStored: sourceArtifactMeta.inlineStored,
          sourceArtifactBytes: sourceArtifactMeta.byteLength,
        }
      : {}),
    ...(payStatementCreated ? { fhirStatementLinesReplaced: statementReplaced } : {}),
    ...(encounterIdForResult ? { encounterId: encounterIdForResult } : {}),
    ...(statementIdForAudit ? { statementId: statementIdForAudit } : {}),
    ...(d.claimStatement?.fhirFx
      ? {
          fhirFxSkipped: d.claimStatement.fhirFx.skippedLineCount,
          fhirFxUsedEnv: d.claimStatement.fhirFx.usedEnvRates,
          fhirFxUsedBuiltin: d.claimStatement.fhirFx.usedBuiltinRates,
        }
      : {}),
    ...(d.explanationOfBenefit
      ? { fhirEobResourceCount: d.explanationOfBenefit.resourceCount }
      : {}),
    ...(requestId ? { requestId } : {}),
  });

  revalidatePath(`/o/${orgSlug}/build`);
  revalidatePath(`/o/${orgSlug}/pay`);
  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  return {
    ok: true,
    payStatementCreated,
    ...(encounterIdForResult
      ? { importedEncounterId: encounterIdForResult }
      : {}),
    ...(statementIdForAudit
      ? { importedStatementId: statementIdForAudit }
      : {}),
    ...(d.explanationOfBenefit
      ? { fhirEobResourceCount: d.explanationOfBenefit.resourceCount }
      : {}),
  };
}

export async function importCsvFixtureFromSettings(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return { error: "Only tenant admins or platform super admins can import fixtures." };
  }

  if (!ctx.enabledModules.has(ModuleKey.BUILD)) {
    return {
      error:
        "Turn on the Build module for this tenant to load encounters (or use seed data only).",
    };
  }

  const csvText = String(formData.get("csvText") ?? "");
  const parsed = normalizeCsvEncounterStatementUpload(csvText);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const payEnabled = ctx.enabledModules.has(ModuleKey.PAY);
  const d = parsed.normalized;
  const claimLines = d.claimStatement?.lines ?? [];
  const fromClaim = payEnabled && claimLines.length > 0;
  const statementTotalCents = fromClaim
    ? claimLines.reduce((s, x) => s + x.amountCents, 0)
    : 25_000;

  const requestId = await readRequestIdFromHeaders();
  let payStatementCreated = false;
  let statementIdForAudit: string | undefined;
  let encounterIdForResult: string | undefined;
  let idempotentPatient = false;
  let idempotentEncounter = false;
  let statementReplaced = false;
  let sourceArtifactMeta:
    | {
        id: string;
        sha256Hex: string;
        byteLength: number;
        inlineStored: boolean;
        externalStored: boolean;
        storageUri: string | null;
      }
    | undefined;

  try {
    const txResult = await persistPatientEncounterImport(tenantPrisma(orgSlug), {
      tenantId: ctx.tenant.id,
      payEnabled,
      normalized: d,
      rawText: csvText,
      connectorKind: "csv_upload",
      sourceKind: "csv_encounter_statement_v1",
      ingestMetadata: {
        path: "settings.import.csv",
        rowCount: parsed.rowCount,
        ...(requestId ? { requestId } : {}),
      },
      claimLines,
      fromClaim,
      statementTotalCents,
      stubStatementCents: 25_000,
      stubLineDescription:
        "Balance from CSV import when no billable line was provided",
      statementNumberOverride: payEnabled ? parsed.payStatementNumber : null,
    });

    encounterIdForResult = txResult.encounterId;
    statementIdForAudit = txResult.statementId;
    payStatementCreated = txResult.payStatementCreated;
    idempotentPatient = txResult.idempotentPatient;
    idempotentEncounter = txResult.idempotentEncounter;
    statementReplaced = txResult.statementReplaced;
    sourceArtifactMeta = txResult.sourceArtifactMeta;
  } catch (e) {
    console.error(e);
    if (
      e instanceof Error &&
      e.message === PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH
    ) {
      return {
        error:
          "This import’s encounter key is already linked to a different patient in this tenant. Fix the file or clear the conflicting import in the database.",
      };
    }
    return { error: "Database error while saving patient / encounter." };
  }

  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "integration.csv_upload.imported",
      resource: "patient_encounter",
      metadata: {
        mrn: d.mrn,
        patientName: `${d.lastName}, ${d.firstName}`,
        csvRowCount: parsed.rowCount,
        csvStatementNumber: parsed.payStatementNumber,
        idempotentPatient,
        idempotentEncounter,
        ...(sourceArtifactMeta
          ? {
              sourceArtifactId: sourceArtifactMeta.id,
              sourceArtifactSha256: sourceArtifactMeta.sha256Hex,
              sourceArtifactBytes: sourceArtifactMeta.byteLength,
              sourceArtifactInlineStored: sourceArtifactMeta.inlineStored,
              sourceArtifactExternalStored: sourceArtifactMeta.externalStored,
              ...(sourceArtifactMeta.storageUri
                ? { sourceArtifactStorageUri: sourceArtifactMeta.storageUri }
                : {}),
            }
          : {}),
        ...(payStatementCreated ? { csvStatementLinesReplaced: statementReplaced } : {}),
        ...(encounterIdForResult ? { encounterId: encounterIdForResult } : {}),
        payStatementCreated,
        ...(statementIdForAudit ? { statementId: statementIdForAudit } : {}),
        ...(payStatementCreated
          ? { statementBalanceCents: statementTotalCents }
          : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "integration.csv_upload.import_ok", {
    tenantId: ctx.tenant.id,
    orgSlug,
    payStatementCreated,
    csvRowCount: parsed.rowCount,
    idempotentPatient,
    idempotentEncounter,
    ...(sourceArtifactMeta
      ? {
          sourceArtifactSha256: sourceArtifactMeta.sha256Hex,
          sourceArtifactInlineStored: sourceArtifactMeta.inlineStored,
          sourceArtifactBytes: sourceArtifactMeta.byteLength,
          sourceArtifactExternalStored: sourceArtifactMeta.externalStored,
        }
      : {}),
    ...(encounterIdForResult ? { encounterId: encounterIdForResult } : {}),
    ...(statementIdForAudit ? { statementId: statementIdForAudit } : {}),
    ...(requestId ? { requestId } : {}),
  });

  revalidatePath(`/o/${orgSlug}/build`);
  revalidatePath(`/o/${orgSlug}/pay`);
  revalidatePath(`/o/${orgSlug}/settings/implementation`);
  return {
    ok: true,
    payStatementCreated,
    ...(encounterIdForResult
      ? { importedEncounterId: encounterIdForResult }
      : {}),
    ...(statementIdForAudit ? { importedStatementId: statementIdForAudit } : {}),
  };
}

export type GreenwayFhirTestActionState =
  | { error: string }
  | {
      ok: true;
      httpStatus: number;
      summary: {
        logicalId: string;
        nameLine: string | null;
        birthDate: string | null;
        gender: string | null;
      };
      previewJson: string | null;
    }
  | null;

/** Live Patient read against Greenway FHIR env (server-side token only). */
export async function testGreenwayFhirPatientFromSettings(
  _prev: GreenwayFhirTestActionState,
  formData: FormData,
): Promise<GreenwayFhirTestActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error:
        "Only tenant admins or platform super admins can run this check.",
    };
  }

  const patientLogicalId = String(
    formData.get("patientLogicalId") ?? "",
  ).trim();
  if (!patientLogicalId) {
    return { error: "Patient logical id is required." };
  }

  const tenantRow = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { slug: true, settings: true },
  });
  if (!tenantRow) {
    return { error: "Organization not found." };
  }

  const cfg = await resolveGreenwayFhirEnvConfigAsyncForTenant(
    tenantRow.slug,
    tenantRow.settings,
  );
  if (!cfg) {
    return {
      error:
        "Greenway FHIR is not configured for this organization. Set global GREENWAY_FHIR_* env and/or Tenant.settings.connectors.greenwayFhir — see .env.example and DEPLOYMENT.md.",
    };
  }
  if (!cfg.accessToken) {
    return {
      error:
        "No bearer token available. Set GREENWAY_FHIR_ACCESS_TOKEN__<SLUG> or global GREENWAY_FHIR_ACCESS_TOKEN, or OAuth client-credentials (per-tenant or global) — see .env.example.",
    };
  }

  let res: Awaited<ReturnType<typeof greenwayFhirGetResource>>;
  try {
    res = await greenwayFhirGetResource(cfg, "Patient", patientLogicalId);
  } catch (e) {
    console.error(e);
    return {
      error:
        e instanceof Error ? e.message : "Request failed before a response.",
    };
  }

  const parsed = summarizeFhirPatientResource(res.body);
  let previewJson: string | null = null;
  try {
    const s = JSON.stringify(res.body, null, 2);
    previewJson = s.length <= 12000 ? s : `${s.slice(0, 12000)}\n…`;
  } catch {
    previewJson = null;
  }

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "integration.greenway_fhir.patient_read_test",
      resource: "external_fhir",
      metadata: {
        httpStatus: res.status,
        patientLogicalId,
        parseOk: parsed.ok,
        ...(!parsed.ok ? { parseMessage: parsed.message } : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "integration.greenway_fhir.patient_read_test", {
    tenantId: ctx.tenant.id,
    orgSlug,
    httpStatus: res.status,
    patientLogicalId,
    parseOk: parsed.ok,
    ...(requestId ? { requestId } : {}),
  });

  if (!res.ok) {
    if (!parsed.ok) {
      return { error: `HTTP ${res.status}: ${parsed.message}` };
    }
    return {
      error: `HTTP ${res.status}: unexpected response shape.`,
    };
  }

  if (!parsed.ok) {
    return { error: `HTTP ${res.status}: ${parsed.message}` };
  }

  return {
    ok: true,
    httpStatus: res.status,
    summary: {
      logicalId: parsed.summary.logicalId,
      nameLine: parsed.summary.nameLine,
      birthDate: parsed.summary.birthDate,
      gender: parsed.summary.gender,
    },
    previewJson,
  };
}

export type GreenwayFhirSyncActionState =
  | { error: string }
  | {
      ok: true;
      anangPatientId: string;
      encountersUpserted: number;
      encounterAnangIds: string[];
      ingestionBatchId: string;
      warnings: string[];
    }
  | null;

/** Persist Patient + Encounters (paginated search) into this tenant — tenant admin only. */
export async function syncGreenwayFhirPatientEncountersFromSettings(
  _prev: GreenwayFhirSyncActionState,
  formData: FormData,
): Promise<GreenwayFhirSyncActionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error:
        "Only tenant admins or platform super admins can run this sync.",
    };
  }

  const patientLogicalId = String(
    formData.get("patientLogicalId") ?? "",
  ).trim();
  if (!patientLogicalId) {
    return { error: "Patient logical id is required." };
  }

  const tenantRow = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { slug: true, settings: true },
  });
  if (!tenantRow) {
    return { error: "Organization not found." };
  }

  const cfg = await resolveGreenwayFhirEnvConfigAsyncForTenant(
    tenantRow.slug,
    tenantRow.settings,
  );
  if (!cfg?.baseUrl) {
    return {
      error:
        "Greenway FHIR base URL is not configured for this organization (env and/or settings.connectors.greenwayFhir).",
    };
  }
  if (!cfg.accessToken) {
    return {
      error:
        "No bearer token available for Greenway (per-tenant or global OAuth / access token).",
    };
  }

  const syncResult = await syncGreenwayPatientEncounters(tenantPrisma(orgSlug), {
    tenantId: ctx.tenant.id,
    config: cfg,
    fhirPatientLogicalId: patientLogicalId,
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: GREENWAY_FHIR_HUB_SYNC_AUDIT_ACTION,
      resource: "external_fhir",
      metadata: {
        patientLogicalId,
        syncOk: syncResult.ok,
        ...(syncResult.ok
          ? {
              anangPatientId: syncResult.anangPatientId,
              encountersUpserted: syncResult.encountersUpserted,
              ingestionBatchId: syncResult.ingestionBatchId,
              warningCount: syncResult.warnings.length,
            }
          : { error: syncResult.error }),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "integration.greenway_fhir.patient_encounter_sync", {
    tenantId: ctx.tenant.id,
    orgSlug,
    patientLogicalId,
    syncOk: syncResult.ok,
    ...(requestId ? { requestId } : {}),
  });

  if (!syncResult.ok) {
    return { error: syncResult.error };
  }

  revalidatePath(`/o/${orgSlug}/build`, "page");
  revalidatePath(`/o/${orgSlug}/pay`, "page");

  return {
    ok: true,
    anangPatientId: syncResult.anangPatientId,
    encountersUpserted: syncResult.encountersUpserted,
    encounterAnangIds: syncResult.encounterAnangIds,
    ingestionBatchId: syncResult.ingestionBatchId,
    warnings: syncResult.warnings,
  };
}

export type GreenwayFhirHubFormState =
  | { intent: "test"; result: GreenwayFhirTestActionState }
  | { intent: "sync"; result: GreenwayFhirSyncActionState }
  | null;

/** Single Implementation hub form: intent=test | sync via submit button `name="intent"`. */
export async function submitGreenwayFhirHubForm(
  _prev: GreenwayFhirHubFormState,
  formData: FormData,
): Promise<GreenwayFhirHubFormState> {
  const intent = String(formData.get("intent") ?? "test");
  if (intent === "sync") {
    const result = await syncGreenwayFhirPatientEncountersFromSettings(
      null,
      formData,
    );
    return { intent: "sync", result };
  }
  const result = await testGreenwayFhirPatientFromSettings(null, formData);
  return { intent: "test", result };
}

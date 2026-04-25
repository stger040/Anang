"use server";

import {
  appendPriorAuthEventDb,
  createPriorAuthCaseDb,
  linkPriorAuthToClaimDb,
  linkPriorAuthToEncounterDb,
  updatePriorAuthCaseStatusDb,
  updatePriorAuthChecklistItemDb,
} from "@/lib/prior-auth/mutations";
import { tenantPrisma } from "@/lib/prisma";
import { requireConnectModule } from "@/lib/prior-auth/require-connect-module";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import {
  ModuleKey,
  PriorAuthChecklistStatus,
  PriorAuthServiceCodeType,
  PriorAuthStatus,
  PriorAuthSubmissionMethod,
  PriorAuthUrgency,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function createPriorAuthCase(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  const patientId = String(formData.get("patientId") ?? "").trim();
  const payerName = String(formData.get("payerName") ?? "").trim();
  if (!patientId || !payerName) throw new Error("Patient and payer are required");

  const encounterId = String(formData.get("encounterId") ?? "").trim() || null;
  const claimId = String(formData.get("claimId") ?? "").trim() || null;
  const coverageId = String(formData.get("coverageId") ?? "").trim() || null;
  const payerPlanName = String(formData.get("payerPlanName") ?? "").trim() || null;
  const urgency = String(formData.get("urgency") ?? "ROUTINE").trim() as PriorAuthUrgency;
  if (!Object.values(PriorAuthUrgency).includes(urgency)) throw new Error("Invalid urgency");
  const smRaw = String(formData.get("submissionMethod") ?? "NOT_SUBMITTED").trim();
  const submissionMethod = (
    Object.values(PriorAuthSubmissionMethod) as string[]
  ).includes(smRaw)
    ? (smRaw as PriorAuthSubmissionMethod)
    : PriorAuthSubmissionMethod.NOT_SUBMITTED;

  const db = tenantPrisma(orgSlug);
  await createPriorAuthCaseDb({
    db,
    orgSlug,
    tenantId: ctx.tenant.id,
    session,
    input: {
      patientId,
      encounterId,
      claimId,
      coverageId,
      payerName,
      payerPlanName,
      urgency,
      priority: String(formData.get("priority") ?? "normal").trim() || "normal",
      submissionMethod,
      source: "staff",
    },
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations`, "page");
  revalidatePath(`/o/${orgSlug}/connect`, "page");
}

/** Prefilled from Build encounter — does not submit to any payer. */
export async function createPriorAuthCaseFromEncounter(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const encounterId = String(formData.get("encounterId") ?? "").trim();
  if (!orgSlug || !encounterId) throw new Error("Invalid form");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);
  if (!ctx.effectiveModules.has(ModuleKey.BUILD)) {
    throw new Error("Forbidden");
  }

  const db = tenantPrisma(orgSlug);
  const enc = await db.encounter.findFirst({
    where: { id: encounterId, tenantId: ctx.tenant.id },
    include: {
      patient: true,
      drafts: { take: 1, orderBy: { id: "desc" }, include: { lines: true } },
    },
  });
  if (!enc) throw new Error("Encounter not found");

  const cov = await db.coverage.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      patientId: enc.patientId,
      priority: "primary",
    },
    orderBy: { id: "asc" },
  });

  const payerName = cov?.payerName?.trim() || "Unknown payer (confirm)";
  const payerPlanName = cov?.planName?.trim() || null;

  const created = await createPriorAuthCaseDb({
    db,
    orgSlug,
    tenantId: ctx.tenant.id,
    session,
    input: {
      patientId: enc.patientId,
      encounterId: enc.id,
      coverageId: cov?.id ?? null,
      payerName,
      payerPlanName,
      source: "build_heuristic",
      externalRefs: {
        draftLineCpts: enc.drafts[0]?.lines.map((l) => l.cpt.trim()) ?? [],
      },
    },
  });

  const draft = enc.drafts[0];
  if (draft?.lines.length) {
    await db.priorAuthService.createMany({
      data: draft.lines.map((l, i) => ({
        caseId: created.id,
        codeType: PriorAuthServiceCodeType.CPT,
        code: l.cpt.trim(),
        description: l.cptDescriptor ?? undefined,
        units: l.units,
        sortOrder: i,
      })),
    });
  }

  revalidatePath(`/o/${orgSlug}/build/encounters/${encounterId}`, "page");
  revalidatePath(`/o/${orgSlug}/connect/authorizations`, "page");
}

export async function updatePriorAuthCaseStatus(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const next = String(formData.get("status") ?? "").trim() as PriorAuthStatus;
  if (!orgSlug || !caseId || !Object.values(PriorAuthStatus).includes(next)) {
    throw new Error("Invalid payload");
  }
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  const patch: Parameters<typeof updatePriorAuthCaseStatusDb>[0]["patch"] = {};
  if (next === "SUBMITTED") patch.submittedAt = new Date();
  if (next === "APPROVED" || next === "DENIED") patch.decisionAt = new Date();
  if (String(formData.get("authorizationNumber") ?? "").trim()) {
    patch.authorizationNumber = String(formData.get("authorizationNumber")).trim();
  }
  if (String(formData.get("expiresAt") ?? "").trim()) {
    const d = new Date(String(formData.get("expiresAt")));
    if (!Number.isNaN(d.getTime())) patch.expiresAt = d;
  }

  await updatePriorAuthCaseStatusDb({
    db: tenantPrisma(orgSlug),
    orgSlug,
    tenantId: ctx.tenant.id,
    session,
    caseId,
    nextStatus: next,
    patch,
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations`, "page");
  revalidatePath(`/o/${orgSlug}/connect/authorizations/${caseId}`, "page");
}

export async function updatePriorAuthChecklistItem(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim() as PriorAuthChecklistStatus;
  if (!orgSlug || !itemId || !Object.values(PriorAuthChecklistStatus).includes(status)) {
    throw new Error("Invalid payload");
  }
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  const notes = String(formData.get("notes") ?? "").trim() || null;
  const { caseId } = await updatePriorAuthChecklistItemDb({
    db: tenantPrisma(orgSlug),
    tenantId: ctx.tenant.id,
    session,
    itemId,
    status,
    notes,
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations/${caseId}`, "page");
}

export async function appendPriorAuthEvent(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "prior_auth.note").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!orgSlug || !caseId || !note) throw new Error("Invalid payload");
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  await appendPriorAuthEventDb({
    db: tenantPrisma(orgSlug),
    tenantId: ctx.tenant.id,
    session,
    caseId,
    eventType,
    payload: { note },
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations/${caseId}`, "page");
}

export async function linkPriorAuthToEncounter(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const encounterId = String(formData.get("encounterId") ?? "").trim();
  if (!orgSlug || !caseId || !encounterId) throw new Error("Select an encounter to link");
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  await linkPriorAuthToEncounterDb({
    db: tenantPrisma(orgSlug),
    orgSlug,
    tenantId: ctx.tenant.id,
    session,
    caseId,
    encounterId,
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations/${caseId}`, "page");
}

export async function linkPriorAuthToClaim(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const claimId = String(formData.get("claimId") ?? "").trim();
  if (!orgSlug || !caseId || !claimId) throw new Error("Select a claim to link");
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) throw new Error("Not found");
  requireConnectModule(ctx.effectiveModules);

  await linkPriorAuthToClaimDb({
    db: tenantPrisma(orgSlug),
    orgSlug,
    tenantId: ctx.tenant.id,
    session,
    caseId,
    claimId,
  });

  revalidatePath(`/o/${orgSlug}/connect/authorizations/${caseId}`, "page");
}

"use server";

import { tenantPrisma } from "@/lib/prisma";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

const TRACKS = new Set([
  "financial_assistance",
  "coverage_marketplace",
  "medicaid_info",
  "charity_care",
  "other",
]);

const STATUSES = new Set([
  "submitted",
  "in_review",
  "approved",
  "denied",
  "needs_info",
  "closed",
]);

export async function createCoverAssistanceCase(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "").trim();
  const track = String(formData.get("track") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const householdRaw = String(formData.get("householdSize") ?? "").trim();
  const incomeRaw = String(formData.get("annualIncomeDollars") ?? "").trim();

  if (!orgSlug || !patientId || !TRACKS.has(track)) {
    throw new Error("Invalid form");
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.COVER)) {
    throw new Error("Forbidden");
  }

  const tenantId = ctx.tenant.id;

  const patient = await tenantPrisma(orgSlug).patient.findFirst({
    where: { id: patientId, tenantId },
  });
  if (!patient) throw new Error("Patient not found");

  const householdSize = householdRaw ? parseInt(householdRaw, 10) : undefined;
  const annualIncomeCents = incomeRaw
    ? Math.round(parseFloat(incomeRaw) * 100)
    : undefined;
  if (
    householdSize !== undefined &&
    (Number.isNaN(householdSize) || householdSize < 1)
  ) {
    throw new Error("Invalid household size");
  }
  if (
    annualIncomeCents !== undefined &&
    (Number.isNaN(annualIncomeCents) || annualIncomeCents < 0)
  ) {
    throw new Error("Invalid income");
  }

  await tenantPrisma(orgSlug).coverAssistanceCase.create({
    data: {
      tenantId,
      patientId: patient.id,
      track,
      status: "submitted",
      notes,
      householdSize: householdSize ?? null,
      annualIncomeCents: annualIncomeCents ?? null,
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "cover.case.created",
      resource: "cover_assistance_case",
      metadata: { patientId, track, ...(requestId ? { requestId } : {}) },
    },
  });

  revalidatePath(`/o/${orgSlug}/cover`, "page");
}

export async function updateCoverCaseStatus(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const caseId = String(formData.get("caseId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!orgSlug || !caseId || !STATUSES.has(status)) {
    throw new Error("Invalid payload");
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.COVER)) {
    throw new Error("Forbidden");
  }

  const tenantId = ctx.tenant.id;

  const row = await tenantPrisma(orgSlug).coverAssistanceCase.findFirst({
    where: { id: caseId, tenantId },
  });
  if (!row) throw new Error("Not found");

  await tenantPrisma(orgSlug).coverAssistanceCase.update({
    where: { id: caseId },
    data: { status },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "cover.case.status",
      resource: "cover_assistance_case",
      metadata: { caseId, status, ...(requestId ? { requestId } : {}) },
    },
  });

  revalidatePath(`/o/${orgSlug}/cover`, "page");
}

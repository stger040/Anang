import { assertLegalPriorAuthTransition } from "@/lib/prior-auth/transitions";
import { PriorAuthEventTypes } from "@/lib/prior-auth/events";
import type { SessionPayload } from "@/lib/session";
import {
  PriorAuthChecklistStatus,
  PriorAuthStatus,
  type PriorAuthSubmissionMethod,
  type PriorAuthUrgency,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { platformLog, readRequestIdFromHeaders } from "@/lib/platform-log";

const CREATE_CASE_MAX_ATTEMPTS = 3;
type PriorAuthDb = PrismaClient | Prisma.TransactionClient;

const DEFAULT_CHECKLIST: { label: string; sortOrder: number }[] = [
  { label: "Clinical documentation complete", sortOrder: 0 },
  { label: "Procedure / diagnosis codes confirmed", sortOrder: 1 },
  { label: "Payer / plan verified for medical benefit", sortOrder: 2 },
  { label: "Submission packet assembled (no auto-submit)", sortOrder: 3 },
];

export async function nextPriorAuthCaseNumber(
  db: PriorAuthDb,
  tenantId: string,
): Promise<string> {
  const y = new Date().getUTCFullYear();
  const c = await db.priorAuthCase.count({ where: { tenantId } });
  return `PA-${y}-${String(c + 1).padStart(5, "0")}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export type CreatePriorAuthCaseInput = {
  patientId: string;
  encounterId?: string | null;
  claimId?: string | null;
  coverageId?: string | null;
  payerName: string;
  payerPlanName?: string | null;
  urgency?: PriorAuthUrgency;
  priority?: string;
  submissionMethod?: PriorAuthSubmissionMethod;
  source?: string;
  scheduledAt?: Date | null;
  externalRefs?: Prisma.InputJsonValue;
};

export async function createPriorAuthCaseDb(args: {
  db: PrismaClient;
  orgSlug: string;
  tenantId: string;
  session: SessionPayload;
  input: CreatePriorAuthCaseInput;
}): Promise<{ id: string; caseNumber: string }> {
  const { db, tenantId, session, input, orgSlug } = args;

  const patient = await db.patient.findFirst({
    where: { id: input.patientId, tenantId },
  });
  if (!patient) throw new Error("Patient not found");

  if (input.encounterId) {
    const e = await db.encounter.findFirst({
      where: { id: input.encounterId, tenantId, patientId: input.patientId },
    });
    if (!e) throw new Error("Encounter not found for patient");
  }
  if (input.claimId) {
    const cl = await db.claim.findFirst({
      where: { id: input.claimId, tenantId, patientId: input.patientId },
    });
    if (!cl) throw new Error("Claim not found for patient");
  }
  if (input.coverageId) {
    const cv = await db.coverage.findFirst({
      where: { id: input.coverageId, tenantId, patientId: input.patientId },
    });
    if (!cv) throw new Error("Coverage not found for patient");
  }

  const requestId = await readRequestIdFromHeaders();

  for (let attempt = 1; attempt <= CREATE_CASE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const row = await db.$transaction(async (tx) => {
        const caseNumber = await nextPriorAuthCaseNumber(tx, tenantId);
        const created = await tx.priorAuthCase.create({
          data: {
            tenantId,
            patientId: input.patientId,
            encounterId: input.encounterId ?? undefined,
            claimId: input.claimId ?? undefined,
            coverageId: input.coverageId ?? undefined,
            caseNumber,
            status: PriorAuthStatus.DRAFT,
            urgency: input.urgency ?? "ROUTINE",
            priority: input.priority ?? "normal",
            source: input.source ?? "staff",
            submissionMethod: input.submissionMethod ?? "NOT_SUBMITTED",
            payerName: input.payerName.trim(),
            payerPlanName: input.payerPlanName?.trim() || undefined,
            externalRefs: input.externalRefs ?? undefined,
          },
        });

        await tx.priorAuthChecklistItem.createMany({
          data: DEFAULT_CHECKLIST.map((c) => ({
            caseId: created.id,
            label: c.label,
            sortOrder: c.sortOrder,
            status: PriorAuthChecklistStatus.PENDING,
          })),
        });

        await tx.priorAuthEvent.create({
          data: {
            caseId: created.id,
            eventType: PriorAuthEventTypes.CREATED,
            payload: { caseNumber, payerName: input.payerName },
            actorUserId: session.userId,
          },
        });

        await tx.auditEvent.create({
          data: {
            tenantId,
            actorUserId: session.userId,
            action: "prior_auth.case.created",
            resource: "prior_auth_case",
            metadata: {
              caseId: created.id,
              caseNumber,
              ...(requestId ? { requestId } : {}),
            },
          },
        });

        return { id: created.id, caseNumber };
      });

      platformLog("info", "prior_auth.case.created", {
        tenantId,
        orgSlug,
        caseId: row.id,
        encounterId: input.encounterId ?? null,
        claimId: input.claimId ?? null,
        requestId: requestId ?? null,
      });

      return row;
    } catch (error) {
      if (attempt < CREATE_CASE_MAX_ATTEMPTS && isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Unable to allocate prior auth case number");
}

export async function updatePriorAuthCaseStatusDb(args: {
  db: PrismaClient;
  orgSlug: string;
  tenantId: string;
  session: SessionPayload;
  caseId: string;
  nextStatus: PriorAuthStatus;
  patch?: {
    submittedAt?: Date | null;
    decisionAt?: Date | null;
    expiresAt?: Date | null;
    authorizationNumber?: string | null;
    payerDecision?: Prisma.InputJsonValue;
  };
}): Promise<void> {
  const { db, tenantId, session, caseId, nextStatus, patch, orgSlug } = args;
  const row = await db.priorAuthCase.findFirst({ where: { id: caseId, tenantId } });
  if (!row) throw new Error("Case not found");
  assertLegalPriorAuthTransition(row.status, nextStatus);

  await db.priorAuthCase.update({
    where: { id: caseId },
    data: {
      status: nextStatus,
      ...patch,
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await db.priorAuthEvent.create({
    data: {
      caseId,
      eventType: PriorAuthEventTypes.STATUS,
      payload: { from: row.status, to: nextStatus },
      actorUserId: session.userId,
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "prior_auth.case.status",
      resource: "prior_auth_case",
      metadata: { caseId, from: row.status, to: nextStatus, ...(requestId ? { requestId } : {}) },
    },
  });

  const eventName =
    nextStatus === PriorAuthStatus.APPROVED
      ? "prior_auth.case.approved"
      : nextStatus === PriorAuthStatus.DENIED
        ? "prior_auth.case.denial"
        : nextStatus === PriorAuthStatus.SUBMITTED
          ? "prior_auth.case.submitted"
          : "prior_auth.case.status_changed";
  platformLog("info", eventName, {
    tenantId,
    orgSlug,
    caseId,
    encounterId: row.encounterId,
    claimId: row.claimId,
    requestId: requestId ?? null,
  });
}

export async function updatePriorAuthChecklistItemDb(args: {
  db: PrismaClient;
  tenantId: string;
  session: SessionPayload;
  itemId: string;
  status: PriorAuthChecklistStatus;
  notes?: string | null;
}): Promise<{ caseId: string }> {
  const { db, tenantId, session, itemId, status, notes } = args;
  const item = await db.priorAuthChecklistItem.findFirst({
    where: { id: itemId },
    include: { case: true },
  });
  if (!item || item.case.tenantId !== tenantId) throw new Error("Checklist item not found");

  await db.priorAuthChecklistItem.update({
    where: { id: itemId },
    data: {
      status,
      notes: notes ?? undefined,
      completedAt: status === PriorAuthChecklistStatus.DONE ? new Date() : null,
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "prior_auth.case.checklist",
      resource: "prior_auth_case",
      metadata: { caseId: item.caseId, itemId, status, ...(requestId ? { requestId } : {}) },
    },
  });

  await db.priorAuthEvent.create({
    data: {
      caseId: item.caseId,
      eventType: PriorAuthEventTypes.CHECKLIST,
      payload: { itemId, status },
      actorUserId: session.userId,
    },
  });

  return { caseId: item.caseId };
}

/** Cron / system — no staff session; still auditable. */
export async function appendPriorAuthSystemEventDb(args: {
  db: PrismaClient;
  tenantId: string;
  orgSlug: string;
  caseId: string;
  eventType: string;
  payload?: Prisma.InputJsonValue;
  auditAction: string;
}): Promise<void> {
  const { db, tenantId, orgSlug, caseId, eventType, payload, auditAction } = args;
  const row = await db.priorAuthCase.findFirst({ where: { id: caseId, tenantId } });
  if (!row) return;

  await db.priorAuthEvent.create({
    data: {
      caseId,
      eventType,
      payload: payload ?? {},
      actorUserId: null,
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: null,
      action: auditAction,
      resource: "prior_auth_case",
      metadata: { caseId, eventType },
    },
  });

  platformLog("warn", auditAction, {
    tenantId,
    orgSlug,
    caseId,
    encounterId: row.encounterId,
    claimId: row.claimId,
  });
}

export async function appendPriorAuthEventDb(args: {
  db: PrismaClient;
  tenantId: string;
  session: SessionPayload;
  caseId: string;
  eventType: string;
  payload?: Prisma.InputJsonValue;
}): Promise<void> {
  const { db, tenantId, session, caseId, eventType, payload } = args;
  const row = await db.priorAuthCase.findFirst({ where: { id: caseId, tenantId } });
  if (!row) throw new Error("Case not found");

  await db.priorAuthEvent.create({
    data: {
      caseId,
      eventType,
      payload: payload ?? {},
      actorUserId: session.userId,
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "prior_auth.case.event",
      resource: "prior_auth_case",
      metadata: { caseId, eventType, ...(requestId ? { requestId } : {}) },
    },
  });
}

export async function linkPriorAuthToEncounterDb(args: {
  db: PrismaClient;
  orgSlug: string;
  tenantId: string;
  session: SessionPayload;
  caseId: string;
  encounterId: string;
}): Promise<void> {
  const { db, tenantId, session, caseId, encounterId, orgSlug } = args;
  const row = await db.priorAuthCase.findFirst({ where: { id: caseId, tenantId } });
  if (!row) throw new Error("Case not found");
  const enc = await db.encounter.findFirst({
    where: { id: encounterId, tenantId, patientId: row.patientId },
  });
  if (!enc) throw new Error("Encounter not found");

  await db.priorAuthCase.update({
    where: { id: caseId },
    data: { encounterId },
  });

  const requestId = await readRequestIdFromHeaders();
  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "prior_auth.case.linked_encounter",
      resource: "prior_auth_case",
      metadata: { caseId, encounterId, ...(requestId ? { requestId } : {}) },
    },
  });
  await db.priorAuthEvent.create({
    data: {
      caseId,
      eventType: PriorAuthEventTypes.LINK_ENCOUNTER,
      payload: { encounterId },
      actorUserId: session.userId,
    },
  });
  platformLog("info", "prior_auth.case.linked_encounter", {
    tenantId,
    orgSlug,
    caseId,
    encounterId,
    claimId: row.claimId,
    requestId: requestId ?? null,
  });
}

export async function linkPriorAuthToClaimDb(args: {
  db: PrismaClient;
  orgSlug: string;
  tenantId: string;
  session: SessionPayload;
  caseId: string;
  claimId: string;
}): Promise<void> {
  const { db, tenantId, session, caseId, claimId, orgSlug } = args;
  const row = await db.priorAuthCase.findFirst({ where: { id: caseId, tenantId } });
  if (!row) throw new Error("Case not found");
  const cl = await db.claim.findFirst({
    where: { id: claimId, tenantId, patientId: row.patientId },
  });
  if (!cl) throw new Error("Claim not found for patient");

  await db.priorAuthCase.update({
    where: { id: caseId },
    data: { claimId },
  });

  const requestId = await readRequestIdFromHeaders();
  await db.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "prior_auth.case.linked_claim",
      resource: "prior_auth_case",
      metadata: { caseId, claimId, ...(requestId ? { requestId } : {}) },
    },
  });
  await db.priorAuthEvent.create({
    data: {
      caseId,
      eventType: PriorAuthEventTypes.LINK_CLAIM,
      payload: { claimId },
      actorUserId: session.userId,
    },
  });
  platformLog("info", "prior_auth.case.linked_claim", {
    tenantId,
    orgSlug,
    caseId,
    claimId,
    encounterId: row.encounterId,
    requestId: requestId ?? null,
  });
}

import { AppRole, PriorAuthStatus, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "@/lib/session";

import {
  createPriorAuthCaseDb,
  linkPriorAuthToClaimDb,
  updatePriorAuthCaseStatusDb,
} from "./mutations";

vi.mock("@/lib/platform-log", () => ({
  platformLog: vi.fn(),
  readRequestIdFromHeaders: vi.fn(async () => undefined),
}));

describe("createPriorAuthCaseDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when patient is not in tenant", async () => {
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;
    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", payerName: "Payer" },
      }),
    ).rejects.toThrow("Patient not found");
  });

  it("persists case, checklist, event, and audit", async () => {
    const priorAuthCase = {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "case1", caseNumber: "PA-2026-00001" }),
    };
    const priorAuthChecklistItem = { createMany: vi.fn() };
    const priorAuthEvent = { create: vi.fn() };
    const auditEvent = { create: vi.fn() };
    const tx = {
      priorAuthCase,
      priorAuthChecklistItem,
      priorAuthEvent,
      auditEvent,
    };
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase,
      priorAuthChecklistItem,
      priorAuthEvent,
      auditEvent,
      $transaction: vi.fn(async <T>(fn: (txArg: typeof tx) => T | Promise<T>) => fn(tx)),
    } as unknown as PrismaClient;

    const out = await createPriorAuthCaseDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      input: { patientId: "p1", payerName: "Payer A" },
    });

    expect(out).toEqual({ id: "case1", caseNumber: "PA-2026-00001" });
    expect(priorAuthCase.create).toHaveBeenCalled();
    expect(priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(priorAuthEvent.create).toHaveBeenCalled();
    expect(auditEvent.create).toHaveBeenCalled();
  });

  it("rejects a claim that does not belong to the PA patient", async () => {
    const claimFindFirst = vi.fn().mockResolvedValue(null);
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      claim: { findFirst: claimFindFirst },
    } as unknown as PrismaClient;

    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", claimId: "claim2", payerName: "Payer A" },
      }),
    ).rejects.toThrow("Claim not found for patient");
    expect(claimFindFirst).toHaveBeenCalledWith({
      where: { id: "claim2", tenantId: "t1", patientId: "p1" },
      select: { id: true, encounterId: true },
    });
  });
});

describe("updatePriorAuthCaseStatusDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects illegal status transition", async () => {
    const tx = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          status: PriorAuthStatus.DRAFT,
          encounterId: null,
          claimId: null,
        }),
        updateMany: vi.fn(),
      },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async <T>(fn: (txArg: typeof tx) => T | Promise<T>) => fn(tx)),
    } as unknown as PrismaClient;

    await expect(
      updatePriorAuthCaseStatusDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "c1",
        nextStatus: PriorAuthStatus.APPROVED,
      }),
    ).rejects.toThrow(/Illegal prior auth status transition/);
    expect(tx.priorAuthCase.updateMany).not.toHaveBeenCalled();
  });

  it("rejects stale concurrent status updates", async () => {
    const tx = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          status: PriorAuthStatus.SUBMITTED,
          encounterId: "enc1",
          claimId: "claim1",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async <T>(fn: (txArg: typeof tx) => T | Promise<T>) => fn(tx)),
    } as unknown as PrismaClient;

    await expect(
      updatePriorAuthCaseStatusDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "c1",
        nextStatus: PriorAuthStatus.APPROVED,
      }),
    ).rejects.toThrow("Case status changed; reload and retry");
    expect(tx.priorAuthEvent.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});

describe("linkPriorAuthToClaimDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects linking a case to another patient's claim", async () => {
    const claimFindFirst = vi.fn().mockResolvedValue(null);
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          id: "case1",
          patientId: "p1",
          encounterId: null,
          claimId: null,
        }),
      },
      claim: { findFirst: claimFindFirst },
    } as unknown as PrismaClient;

    await expect(
      linkPriorAuthToClaimDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "case1",
        claimId: "claim2",
      }),
    ).rejects.toThrow("Claim not found for patient");
    expect(claimFindFirst).toHaveBeenCalledWith({
      where: { id: "claim2", tenantId: "t1", patientId: "p1" },
      select: { id: true, encounterId: true },
    });
  });
});

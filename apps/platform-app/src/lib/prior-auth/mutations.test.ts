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
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const db = transactionClient(tx);

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
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase,
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = transactionClient(tx);

    const out = await createPriorAuthCaseDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      input: { patientId: "p1", payerName: "Payer A" },
    });

    expect(out).toEqual({ id: "case1", caseNumber: "PA-2026-00001" });
    expect(priorAuthCase.create).toHaveBeenCalled();
    expect(tx.priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(tx.priorAuthEvent.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("rejects a claim that does not belong to the case patient", async () => {
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const db = transactionClient(tx);

    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", claimId: "claim-other", payerName: "Payer A" },
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(tx.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-other", tenantId: "t1", patientId: "p1" },
    });
  });

  it("retries when a concurrent create races on case number allocation", async () => {
    const conflict = { code: "P2002", meta: { target: ["tenantId", "caseNumber"] } };
    const tx1 = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue(conflict),
      },
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const tx2 = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: "case2", caseNumber: "PA-2026-00002" }),
      },
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = transactionClient(tx1, tx2);

    const out = await createPriorAuthCaseDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      input: { patientId: "p1", payerName: "Payer A" },
    });

    expect(out).toEqual({ id: "case2", caseNumber: "PA-2026-00002" });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(tx2.priorAuthChecklistItem.createMany).toHaveBeenCalled();
  });
});

describe("linkPriorAuthToClaimDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects a claim from another patient in the same tenant", async () => {
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          id: "case1",
          patientId: "p1",
          encounterId: null,
          claimId: null,
        }),
        update: vi.fn(),
      },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      linkPriorAuthToClaimDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "case1",
        claimId: "claim-other",
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(db.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-other", tenantId: "t1", patientId: "p1" },
    });
    expect(db.priorAuthCase.update).not.toHaveBeenCalled();
  });
});

describe("updatePriorAuthCaseStatusDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects illegal status transition", async () => {
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          status: PriorAuthStatus.DRAFT,
          encounterId: null,
          claimId: null,
        }),
        update: vi.fn(),
      },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
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
    expect(db.priorAuthCase.update).not.toHaveBeenCalled();
  });
});

function transactionClient(...txs: unknown[]): PrismaClient & { $transaction: ReturnType<typeof vi.fn> } {
  const queue = [...txs];
  return {
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => {
      const tx = queue.shift();
      if (!tx) throw new Error("Unexpected transaction call");
      return cb(tx);
    }),
  } as unknown as PrismaClient & { $transaction: ReturnType<typeof vi.fn> };
}

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
    const tx = {
      priorAuthCase,
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      $transaction: vi.fn(
        async (cb: (txArg: typeof tx) => unknown | Promise<unknown>) => cb(tx),
      ),
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
    expect(tx.priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(tx.priorAuthEvent.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("rejects claim links that do not belong to the case patient", async () => {
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(),
    } as unknown as PrismaClient;

    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", claimId: "claim-other", payerName: "Payer A" },
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(db.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-other", tenantId: "t1", patientId: "p1" },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("retries case number collisions and keeps create side effects atomic", async () => {
    const duplicateError = Object.assign(new Error("duplicate case number"), {
      code: "P2002",
    });
    const duplicateTx = {
      priorAuthCase: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockRejectedValue(duplicateError),
      },
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const successTx = {
      priorAuthCase: {
        count: vi.fn().mockResolvedValue(1),
        create: vi.fn().mockResolvedValue({ id: "case2", caseNumber: "PA-2026-00002" }),
      },
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      $transaction: vi
        .fn()
        .mockImplementationOnce(
          async (
            cb: (txArg: typeof duplicateTx) => unknown | Promise<unknown>,
          ) => cb(duplicateTx),
        )
        .mockImplementationOnce(
          async (cb: (txArg: typeof successTx) => unknown | Promise<unknown>) =>
            cb(successTx),
        ),
    } as unknown as PrismaClient;

    const out = await createPriorAuthCaseDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      input: { patientId: "p1", payerName: "Payer A" },
    });

    expect(out).toEqual({ id: "case2", caseNumber: "PA-2026-00002" });
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    expect(duplicateTx.priorAuthChecklistItem.createMany).not.toHaveBeenCalled();
    expect(successTx.priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(successTx.priorAuthEvent.create).toHaveBeenCalled();
    expect(successTx.auditEvent.create).toHaveBeenCalled();
  });
});

describe("linkPriorAuthToClaimDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects a same-tenant claim for a different patient", async () => {
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

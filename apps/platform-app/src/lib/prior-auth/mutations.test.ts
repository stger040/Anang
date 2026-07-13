import {
  AppRole,
  PriorAuthServiceCodeType,
  PriorAuthStatus,
  type PrismaClient,
} from "@prisma/client";
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

  function dbWithTransaction(tx: unknown) {
    return {
      $transaction: vi.fn(async (callback: (txArg: unknown) => unknown) => callback(tx)),
    } as unknown as PrismaClient;
  }

  it("throws when patient is not in tenant", async () => {
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const db = dbWithTransaction(tx);
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

  it("persists case, services, checklist, event, and audit in one transaction", async () => {
    const priorAuthCase = {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: "case1", caseNumber: "PA-2026-00001" }),
    };
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase,
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthService: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = dbWithTransaction(tx);

    const out = await createPriorAuthCaseDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      input: { patientId: "p1", payerName: "Payer A" },
      services: [
        {
          codeType: PriorAuthServiceCodeType.CPT,
          code: " 70553 ",
          description: " Brain MRI ",
          units: 1,
        },
      ],
    });

    expect(out).toEqual({ id: "case1", caseNumber: "PA-2026-00001" });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(priorAuthCase.create).toHaveBeenCalled();
    expect(tx.priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(tx.priorAuthService.createMany).toHaveBeenCalledWith({
      data: [
        {
          caseId: "case1",
          codeType: PriorAuthServiceCodeType.CPT,
          code: "70553",
          description: "Brain MRI",
          units: 1,
          notes: undefined,
          sortOrder: 0,
        },
      ],
    });
    expect(tx.priorAuthEvent.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });

  it("rejects a claim that belongs to a different patient", async () => {
    const tx = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
      priorAuthCase: {
        count: vi.fn(),
        create: vi.fn(),
      },
    };
    const db = dbWithTransaction(tx);

    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", claimId: "claim-for-p2", payerName: "Payer A" },
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(tx.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-for-p2", tenantId: "t1", patientId: "p1" },
    });
    expect(tx.priorAuthCase.create).not.toHaveBeenCalled();
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
      $transaction: vi.fn(async (callback: (txArg: unknown) => unknown) => callback(tx)),
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

  it("rejects when a concurrent transition already changed the status", async () => {
    const tx = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          status: PriorAuthStatus.SUBMITTED,
          encounterId: "enc1",
          claimId: "cl1",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (callback: (txArg: unknown) => unknown) => callback(tx)),
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
    ).rejects.toThrow("Case status changed; retry transition");

    expect(tx.priorAuthCase.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", tenantId: "t1", status: PriorAuthStatus.SUBMITTED },
      data: { status: PriorAuthStatus.APPROVED },
    });
    expect(tx.priorAuthEvent.create).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("conditionally updates status and writes audit/event in the same transaction", async () => {
    const tx = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          status: PriorAuthStatus.SUBMITTED,
          encounterId: "enc1",
          claimId: "cl1",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      $transaction: vi.fn(async (callback: (txArg: unknown) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await updatePriorAuthCaseStatusDb({
      db,
      orgSlug: "acme",
      tenantId: "t1",
      session,
      caseId: "c1",
      nextStatus: PriorAuthStatus.APPROVED,
    });

    expect(tx.priorAuthCase.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", tenantId: "t1", status: PriorAuthStatus.SUBMITTED },
      data: { status: PriorAuthStatus.APPROVED },
    });
    expect(tx.priorAuthEvent.create).toHaveBeenCalled();
    expect(tx.auditEvent.create).toHaveBeenCalled();
  });
});

describe("linkPriorAuthToClaimDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("rejects claims that do not belong to the prior-auth patient", async () => {
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({ id: "pa1", patientId: "p1", encounterId: null }),
        update: vi.fn(),
      },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
      auditEvent: { create: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      linkPriorAuthToClaimDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "pa1",
        claimId: "claim-p2",
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(db.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-p2", tenantId: "t1", patientId: "p1" },
    });
    expect(db.priorAuthCase.update).not.toHaveBeenCalled();
  });

  it("rejects claims linked to a different encounter", async () => {
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({ id: "pa1", patientId: "p1", encounterId: "enc1" }),
        update: vi.fn(),
      },
      claim: { findFirst: vi.fn().mockResolvedValue({ id: "claim1", patientId: "p1", encounterId: "enc2" }) },
      auditEvent: { create: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
    } as unknown as PrismaClient;

    await expect(
      linkPriorAuthToClaimDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        caseId: "pa1",
        claimId: "claim1",
      }),
    ).rejects.toThrow("Claim belongs to a different encounter");

    expect(db.priorAuthCase.update).not.toHaveBeenCalled();
  });
});

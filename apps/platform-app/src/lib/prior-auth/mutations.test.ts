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
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      priorAuthCase,
      priorAuthChecklistItem: { createMany: vi.fn() },
      priorAuthEvent: { create: vi.fn() },
      auditEvent: { create: vi.fn() },
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
    expect(db.priorAuthChecklistItem.createMany).toHaveBeenCalled();
    expect(db.priorAuthEvent.create).toHaveBeenCalled();
    expect(db.auditEvent.create).toHaveBeenCalled();
  });

  it("requires an initial claim link to belong to the case patient", async () => {
    const db = {
      patient: { findFirst: vi.fn().mockResolvedValue({ id: "p1" }) },
      claim: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    await expect(
      createPriorAuthCaseDb({
        db,
        orgSlug: "acme",
        tenantId: "t1",
        session,
        input: { patientId: "p1", claimId: "claim-other", payerName: "Payer" },
      }),
    ).rejects.toThrow("Claim not found for patient");

    expect(db.claim.findFirst).toHaveBeenCalledWith({
      where: { id: "claim-other", tenantId: "t1", patientId: "p1" },
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

describe("linkPriorAuthToClaimDb", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "a@test",
    appRole: AppRole.STAFF,
  };

  it("requires linked claims to belong to the case patient", async () => {
    const db = {
      priorAuthCase: {
        findFirst: vi.fn().mockResolvedValue({
          id: "case1",
          patientId: "p1",
          encounterId: null,
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

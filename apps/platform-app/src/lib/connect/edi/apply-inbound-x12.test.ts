import { ClaimLifecycleStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyInboundX12ToTenant,
  isDenied835Status,
} from "./apply-inbound-x12";

function make835Db(claim: {
  id?: string;
  status: ClaimLifecycleStatus;
  billedCents?: number;
  paidCents?: number | null;
  denialReason?: string | null;
}) {
  const claimRow = {
    id: claim.id ?? "claim1",
    tenantId: "t1",
    claimNumber: "CLM-1",
    status: claim.status,
    billedCents: claim.billedCents ?? 10000,
    paidCents: claim.paidCents ?? null,
    denialReason: claim.denialReason ?? null,
    ediRefs: {},
  };
  const claimUpdate = vi.fn().mockResolvedValue({});
  const timelineCreate = vi.fn();
  const adjudicationUpsert = vi.fn().mockResolvedValue({ id: "adj1" });
  const db = {
    claim: {
      findFirst: vi.fn().mockResolvedValue(claimRow),
      update: claimUpdate,
    },
    remittance835: {
      upsert: vi.fn().mockResolvedValue({ id: "remit1" }),
    },
    claimTimelineEvent: { create: timelineCreate },
    claimAdjudication: {
      upsert: adjudicationUpsert,
    },
    remittanceAdjudicationLine: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  } as unknown as PrismaClient;

  return { db, claimUpdate, timelineCreate, adjudicationUpsert };
}

const structuralOk = {
  ok: true as const,
  issues: [],
  guide: "835-5010-min",
  transactionSet: "835" as const,
  segmentCount: 3,
};

describe("isDenied835Status", () => {
  it("treats only CLP02=4 as denied", () => {
    expect(isDenied835Status("4")).toBe(true);
    expect(isDenied835Status("1")).toBe(false);
    expect(isDenied835Status("2")).toBe(false);
    expect(isDenied835Status("3")).toBe(false);
    expect(isDenied835Status("22")).toBe(false);
    expect(isDenied835Status("23")).toBe(false);
  });
});

describe("applyInboundX12ToTenant 835 CLP02 denial mapping", () => {
  it("does not mark secondary zero-pay (CLP02=2) as DENIED", async () => {
    const { db, claimUpdate, timelineCreate, adjudicationUpsert } = make835Db({
      status: ClaimLifecycleStatus.ACCEPTED,
    });

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*835*0001~CLP*CLM-1*2*100.00*0~SE*3*0001~",
      structuralValidation: structuralOk,
    });

    expect(result.matched).toEqual([
      { claimNumber: "CLM-1", action: "timeline" },
    ]);
    expect(claimUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "claim1" },
        data: expect.objectContaining({
          status: ClaimLifecycleStatus.ACCEPTED,
        }),
      }),
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
    expect(timelineCreate.mock.calls[0]?.[0]?.data?.label).toBe(
      "835 — CLP status 2",
    );
    expect(adjudicationUpsert.mock.calls[0]?.[0]?.create?.denialCategory).toBeNull();
  });

  it("marks true denial (CLP02=4) with zero pay as DENIED", async () => {
    const { db, claimUpdate, timelineCreate, adjudicationUpsert } = make835Db({
      status: ClaimLifecycleStatus.SUBMITTED,
    });

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*835*0001~CLP*CLM-1*4*100.00*0~SE*3*0001~",
      structuralValidation: structuralOk,
    });

    expect(result.matched).toEqual([
      { claimNumber: "CLM-1", action: "status→DENIED" },
    ]);
    expect(claimUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ClaimLifecycleStatus.DENIED,
          denialReason: "835 CLP02=4",
        }),
      }),
    );
    expect(timelineCreate.mock.calls[0]?.[0]?.data?.label).toBe("835 — denial");
    expect(adjudicationUpsert.mock.calls[0]?.[0]?.create?.denialCategory).toBe(
      "835 CLP02=4",
    );
  });

  it("does not mark reversal (CLP02=22) zero-pay as DENIED", async () => {
    const { db, claimUpdate, timelineCreate } = make835Db({
      status: ClaimLifecycleStatus.PAID,
      paidCents: 8000,
    });

    await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*835*0001~CLP*CLM-1*22*100.00*0~SE*3*0001~",
      structuralValidation: structuralOk,
    });

    expect(claimUpdate.mock.calls[0]?.[0]?.data?.status).toBe(
      ClaimLifecycleStatus.PAID,
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
    expect(timelineCreate.mock.calls[0]?.[0]?.data?.label).toBe(
      "835 — CLP status 22",
    );
  });

  it("does not mark forwarded not-our-claim (CLP02=23) as DENIED", async () => {
    const { db, claimUpdate } = make835Db({
      status: ClaimLifecycleStatus.ACCEPTED,
    });

    await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*835*0001~CLP*CLM-1*23*100.00*0~SE*3*0001~",
      structuralValidation: structuralOk,
    });

    expect(claimUpdate.mock.calls[0]?.[0]?.data?.status).toBe(
      ClaimLifecycleStatus.ACCEPTED,
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
  });
});

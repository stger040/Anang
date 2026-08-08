import { ClaimLifecycleStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyInboundX12ToTenant,
  isDenied277Status,
} from "./apply-inbound-x12";
import type { X12ValidationResult } from "./validate-x12-structure";

function make277Db(claim: {
  id?: string;
  status: ClaimLifecycleStatus;
  denialReason?: string | null;
}) {
  const claimRow = {
    id: claim.id ?? "claim1",
    tenantId: "t1",
    claimNumber: "CLM-1",
    status: claim.status,
    billedCents: 10000,
    paidCents: null,
    denialReason: claim.denialReason ?? null,
    ediRefs: {},
  };
  const claimUpdate = vi.fn().mockResolvedValue({});
  const timelineCreate = vi.fn();
  const db = {
    claim: {
      findFirst: vi.fn().mockResolvedValue(claimRow),
      update: claimUpdate,
    },
    claimTimelineEvent: { create: timelineCreate },
  } as unknown as PrismaClient;

  return { db, claimUpdate, timelineCreate };
}

const structuralOk277: X12ValidationResult = {
  ok: true,
  issues: [],
  guide: "277-5010-min",
  transactionSet: "277",
  segmentCount: 3,
};

describe("isDenied277Status", () => {
  it("treats only CLP02=4 as denied", () => {
    expect(isDenied277Status("4")).toBe(true);
    expect(isDenied277Status("1")).toBe(false);
    expect(isDenied277Status("2")).toBe(false);
    expect(isDenied277Status("3")).toBe(false);
    expect(isDenied277Status("23")).toBe(false);
    expect(isDenied277Status("24")).toBe(false);
  });
});

describe("applyInboundX12ToTenant 277 CLP02 status mapping", () => {
  it("treats tertiary processed (CLP02=3) as ACCEPTED, not DENIED", async () => {
    const { db, claimUpdate, timelineCreate } = make277Db({
      status: ClaimLifecycleStatus.SUBMITTED,
    });

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*277*0001~CLP*CLM-1*3*100.00~SE*3*0001~",
      structuralValidation: structuralOk277,
    });

    expect(result.matched).toEqual([
      { claimNumber: "CLM-1", action: "status→ACCEPTED" },
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
      "277 — claim accepted at payer",
    );
  });

  it("marks true denial (CLP02=4) as DENIED", async () => {
    const { db, claimUpdate, timelineCreate } = make277Db({
      status: ClaimLifecycleStatus.SUBMITTED,
    });

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*277*0001~CLP*CLM-1*4*100.00~SE*3*0001~",
      structuralValidation: structuralOk277,
    });

    expect(result.matched).toEqual([
      { claimNumber: "CLM-1", action: "status→DENIED" },
    ]);
    expect(claimUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ClaimLifecycleStatus.DENIED,
          denialReason: "277 CLP02=4",
        }),
      }),
    );
    expect(timelineCreate.mock.calls[0]?.[0]?.data?.label).toBe(
      "277 — payer denied / rejected",
    );
  });

  it("does not mark forwarded not-our-claim (CLP02=23) as DENIED", async () => {
    const { db, claimUpdate, timelineCreate } = make277Db({
      status: ClaimLifecycleStatus.ACCEPTED,
    });

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*277*0001~CLP*CLM-1*23*100.00~SE*3*0001~",
      structuralValidation: structuralOk277,
    });

    expect(result.matched).toEqual([
      { claimNumber: "CLM-1", action: "timeline" },
    ]);
    expect(claimUpdate.mock.calls[0]?.[0]?.data?.status).toBe(
      ClaimLifecycleStatus.ACCEPTED,
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
    expect(timelineCreate.mock.calls[0]?.[0]?.data?.label).toBe(
      "277 — status code 23",
    );
  });

  it("does not mark predetermination-only (CLP02=24) as DENIED", async () => {
    const { db, claimUpdate } = make277Db({
      status: ClaimLifecycleStatus.SUBMITTED,
    });

    await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*277*0001~CLP*CLM-1*24*100.00~SE*3*0001~",
      structuralValidation: structuralOk277,
    });

    expect(claimUpdate.mock.calls[0]?.[0]?.data?.status).toBe(
      ClaimLifecycleStatus.SUBMITTED,
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
  });

  it("still refuses to regress PAID claims on a 277 denial", async () => {
    const { db, claimUpdate } = make277Db({
      status: ClaimLifecycleStatus.PAID,
    });

    await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*277*0001~CLP*CLM-1*4*100.00~SE*3*0001~",
      structuralValidation: structuralOk277,
    });

    expect(claimUpdate.mock.calls[0]?.[0]?.data?.status).toBe(
      ClaimLifecycleStatus.PAID,
    );
  });
});

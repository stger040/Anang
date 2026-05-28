import { ClaimLifecycleStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { applyInboundX12ToTenant } from "./apply-inbound-x12";

describe("applyInboundX12ToTenant", () => {
  it("does not regress a paid claim to denied from a later zero-pay 835 row", async () => {
    const claim = {
      id: "claim1",
      tenantId: "t1",
      claimNumber: "CLM-1",
      status: ClaimLifecycleStatus.PAID,
      billedCents: 10000,
      paidCents: 8000,
      denialReason: null,
      ediRefs: {},
    };
    const claimUpdate = vi.fn().mockResolvedValue({});
    const db = {
      claim: {
        findFirst: vi.fn().mockResolvedValue(claim),
        update: claimUpdate,
      },
      remittance835: {
        upsert: vi.fn().mockResolvedValue({ id: "remit1" }),
      },
      claimTimelineEvent: { create: vi.fn() },
      claimAdjudication: {
        upsert: vi.fn().mockResolvedValue({ id: "adj1" }),
      },
      remittanceAdjudicationLine: { create: vi.fn() },
    } as unknown as PrismaClient;

    const result = await applyInboundX12ToTenant({
      db,
      tenantId: "t1",
      x12: "ST*835*0001~CLP*CLM-1*2*100.00*0~SE*3*0001~",
      structuralValidation: {
        ok: true,
        issues: [],
        guide: "835-5010-min",
        transactionSet: "835",
        segmentCount: 3,
      },
    });

    expect(result.matched).toEqual([{ claimNumber: "CLM-1", action: "timeline" }]);
    expect(claimUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "claim1" },
        data: expect.objectContaining({
          status: ClaimLifecycleStatus.PAID,
        }),
      }),
    );
    expect(claimUpdate.mock.calls[0]?.[0]?.data).not.toHaveProperty(
      "denialReason",
    );
  });
});

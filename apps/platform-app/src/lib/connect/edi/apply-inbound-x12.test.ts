import { ClaimLifecycleStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { applyInboundX12ToTenant, inbound835RemittanceKey } from "./apply-inbound-x12";

const INBOUND_835 =
  "ST*835*0001~TRN*1*TRACE-123~CLP*CLAIM-1*1*100.00*80.00~SE*4*0001~";

function makeDb() {
  const remittanceUpsert = vi.fn().mockResolvedValue({ id: "remit1" });
  const adjudicationUpsert = vi.fn().mockResolvedValue({ id: "adj1" });
  const db = {
    remittance835: { upsert: remittanceUpsert },
    claim: {
      findFirst: vi.fn().mockResolvedValue({
        id: "claim1",
        claimNumber: "CLAIM-1",
        status: ClaimLifecycleStatus.SUBMITTED,
        billedCents: 10000,
        paidCents: null,
        denialReason: null,
        ediRefs: {},
      }),
      update: vi.fn(),
    },
    claimTimelineEvent: { create: vi.fn() },
    claimAdjudication: { upsert: adjudicationUpsert },
    remittanceAdjudicationLine: {
      deleteMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "line1" }),
    },
  } as unknown as PrismaClient;

  return { db, remittanceUpsert, adjudicationUpsert };
}

describe("applyInboundX12ToTenant", () => {
  it("uses a payload-derived 835 remittance key across delivery retries", async () => {
    const first = makeDb();
    const second = makeDb();

    await applyInboundX12ToTenant({
      db: first.db,
      tenantId: "t1",
      x12: INBOUND_835,
      ingestionBatchId: "batch-first-delivery",
    });
    await applyInboundX12ToTenant({
      db: second.db,
      tenantId: "t1",
      x12: INBOUND_835,
      ingestionBatchId: "batch-retry-delivery",
    });

    const expectedKey = inbound835RemittanceKey(INBOUND_835);
    expect(
      first.remittanceUpsert.mock.calls[0]?.[0].where.tenantId_remittanceKey
        .remittanceKey,
    ).toBe(expectedKey);
    expect(
      second.remittanceUpsert.mock.calls[0]?.[0].where.tenantId_remittanceKey
        .remittanceKey,
    ).toBe(expectedKey);
    expect(first.adjudicationUpsert.mock.calls[0]?.[0].create.adjudicationKey).toBe(
      `${expectedKey}:CLAIM-1:0`,
    );
    expect(
      second.adjudicationUpsert.mock.calls[0]?.[0].create.adjudicationKey,
    ).toBe(`${expectedKey}:CLAIM-1:0`);
  });
});

import { ClaimLifecycleStatus, type PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  applyInboundX12ToTenant,
  inbound835RemittanceKey,
} from "./apply-inbound-x12";

const INBOUND_835_A =
  "ST*835*0001~TRN*1*TRACE-A~CLP*CLAIM-1*1*100.00*40.00~SE*4*0001~";
const INBOUND_835_B =
  "ST*835*0002~TRN*1*TRACE-B~CLP*CLAIM-1*1*100.00*60.00~SE*4*0002~";

type AdjRow = { adjudicationKey: string; paidCents: number };

function makeDb(opts?: { initialPaidCents?: number | null; adjStore?: AdjRow[] }) {
  const adjStore = opts?.adjStore ?? [];
  const remittanceUpsert = vi.fn().mockResolvedValue({ id: "remit1" });
  const claimUpdate = vi.fn();
  const adjudicationUpsert = vi.fn().mockImplementation(async (args: {
    where: { tenantId_adjudicationKey: { adjudicationKey: string } };
    create: { paidCents: number; adjudicationKey: string };
    update: { paidCents: number };
  }) => {
    const key = args.where.tenantId_adjudicationKey.adjudicationKey;
    const existing = adjStore.find((r) => r.adjudicationKey === key);
    if (existing) {
      existing.paidCents = args.update.paidCents;
      return { id: "adj-existing" };
    }
    adjStore.push({
      adjudicationKey: key,
      paidCents: args.create.paidCents,
    });
    return { id: "adj-new" };
  });
  const adjudicationAggregate = vi.fn().mockImplementation(async () => ({
    _sum: {
      paidCents: adjStore.reduce((s, r) => s + r.paidCents, 0),
    },
  }));

  const db = {
    remittance835: { upsert: remittanceUpsert },
    claim: {
      findFirst: vi.fn().mockResolvedValue({
        id: "claim1",
        claimNumber: "CLAIM-1",
        status: ClaimLifecycleStatus.SUBMITTED,
        billedCents: 10000,
        paidCents: opts?.initialPaidCents ?? null,
        denialReason: null,
        ediRefs: {},
      }),
      update: claimUpdate,
    },
    claimTimelineEvent: { create: vi.fn() },
    claimAdjudication: {
      upsert: adjudicationUpsert,
      aggregate: adjudicationAggregate,
      findFirst: vi.fn().mockResolvedValue({
        id: "claim1",
        billedCents: 10000,
      }),
    },
    remittanceAdjudicationLine: {
      deleteMany: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "line1" }),
    },
  } as unknown as PrismaClient;

  return {
    db,
    remittanceUpsert,
    adjudicationUpsert,
    claimUpdate,
    adjStore,
  };
}

describe("inbound835RemittanceKey", () => {
  it("is stable for identical payloads", () => {
    expect(inbound835RemittanceKey(INBOUND_835_A)).toBe(
      inbound835RemittanceKey(INBOUND_835_A),
    );
    expect(inbound835RemittanceKey(INBOUND_835_A)).not.toBe(
      inbound835RemittanceKey(INBOUND_835_B),
    );
  });
});

describe("applyInboundX12ToTenant 835 paid totals", () => {
  it("uses a payload-derived 835 remittance key across delivery retries", async () => {
    const first = makeDb();
    const second = makeDb();

    await applyInboundX12ToTenant({
      db: first.db,
      tenantId: "t1",
      x12: INBOUND_835_A,
      ingestionBatchId: "batch-first-delivery",
    });
    await applyInboundX12ToTenant({
      db: second.db,
      tenantId: "t1",
      x12: INBOUND_835_A,
      ingestionBatchId: "batch-retry-delivery",
    });

    const expectedKey = inbound835RemittanceKey(INBOUND_835_A);
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

  it("accumulates Claim.paidCents across distinct remittance payments", async () => {
    const adjStore: AdjRow[] = [];
    const first = makeDb({ adjStore });
    const second = makeDb({ adjStore, initialPaidCents: 4000 });

    await applyInboundX12ToTenant({
      db: first.db,
      tenantId: "t1",
      x12: INBOUND_835_A,
      ingestionBatchId: "era-1",
    });
    expect(first.claimUpdate.mock.calls[0]?.[0].data.paidCents).toBe(4000);

    await applyInboundX12ToTenant({
      db: second.db,
      tenantId: "t1",
      x12: INBOUND_835_B,
      ingestionBatchId: "era-2",
    });
    expect(second.claimUpdate.mock.calls[0]?.[0].data.paidCents).toBe(10000);
    expect(adjStore).toHaveLength(2);
  });

  it("does not double-count Claim.paidCents when the same 835 is retried", async () => {
    const adjStore: AdjRow[] = [];
    const first = makeDb({ adjStore });
    const retry = makeDb({ adjStore, initialPaidCents: 4000 });

    await applyInboundX12ToTenant({
      db: first.db,
      tenantId: "t1",
      x12: INBOUND_835_A,
      ingestionBatchId: "batch-1",
    });
    await applyInboundX12ToTenant({
      db: retry.db,
      tenantId: "t1",
      x12: INBOUND_835_A,
      ingestionBatchId: "batch-1-retry",
    });

    expect(retry.claimUpdate.mock.calls[0]?.[0].data.paidCents).toBe(4000);
    expect(adjStore).toHaveLength(1);
  });
});

import { Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";

import { postStripeCheckoutCompletedPayment } from "./stripe-webhook-posting";

vi.mock("@/lib/pay/plan-installment-allocation", () => ({
  allocatePaymentToPlanInstallments: vi.fn(),
}));

function makeDb(args: {
  statement?: { id: string; balanceCents: number; status: string } | null;
  duplicatePayment?: { id: string } | null;
}) {
  const tx = {
    payment: {
      findFirst: vi.fn().mockResolvedValue(args.duplicatePayment ?? null),
      create: vi.fn().mockResolvedValue({ id: "pay_1" }),
    },
    statement: {
      findFirst: vi.fn().mockResolvedValue(args.statement ?? null),
      update: vi.fn().mockResolvedValue({}),
    },
    auditEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const db = {
    $transaction: vi.fn(async (cb: (txArg: typeof tx) => unknown) => cb(tx)),
  };
  return { db: db as unknown as PrismaClient, rawDb: db, tx };
}

const baseArgs = {
  tenantId: "tenant_1",
  statementId: "stmt_1",
  stripeCheckoutSessionId: "cs_1",
  stripeEventId: "evt_1",
  requestId: "req_1",
};

describe("postStripeCheckoutCompletedPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies only the current balance and records unapplied overpayment", async () => {
    const { db, rawDb, tx } = makeDb({
      statement: { id: "stmt_1", balanceCents: 5_000, status: "open" },
    });

    const result = await postStripeCheckoutCompletedPayment(db, {
      ...baseArgs,
      amountCents: 8_000,
    });

    expect(result).toMatchObject({
      status: "posted",
      amountCents: 8_000,
      appliedCents: 5_000,
      unappliedCents: 3_000,
      startingBalanceCents: 5_000,
      endingBalanceCents: 0,
    });
    expect(rawDb.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountCents: 8_000,
          status: "posted",
          stripeCheckoutSessionId: "cs_1",
        }),
      }),
    );
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt_1" },
      data: { balanceCents: 0, status: "paid" },
    });
    expect(allocatePaymentToPlanInstallments).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amountCents: 5_000, paymentId: "pay_1" }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            amountCents: 8_000,
            appliedCents: 5_000,
            unappliedCents: 3_000,
            startingBalanceCents: 5_000,
            endingBalanceCents: 0,
          }),
        }),
      }),
    );
  });

  it("does not create another payment for the same Stripe checkout session", async () => {
    const { db, tx } = makeDb({
      statement: { id: "stmt_1", balanceCents: 5_000, status: "open" },
      duplicatePayment: { id: "existing" },
    });

    await expect(
      postStripeCheckoutCompletedPayment(db, {
        ...baseArgs,
        amountCents: 5_000,
      }),
    ).resolves.toEqual({ status: "duplicate" });

    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.statement.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });

  it("retries serializable write conflicts before posting", async () => {
    const { db, rawDb } = makeDb({
      statement: { id: "stmt_1", balanceCents: 5_000, status: "open" },
    });
    rawDb.$transaction = vi
      .fn()
      .mockRejectedValueOnce({ code: "P2034" })
      .mockImplementation(async (cb: (txArg: unknown) => unknown) =>
        cb({
          payment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "pay_retry" }),
          },
          statement: {
            findFirst: vi
              .fn()
              .mockResolvedValue({ id: "stmt_1", balanceCents: 5_000, status: "open" }),
            update: vi.fn().mockResolvedValue({}),
          },
          auditEvent: { create: vi.fn().mockResolvedValue({}) },
        }),
      );

    await expect(
      postStripeCheckoutCompletedPayment(db, {
        ...baseArgs,
        amountCents: 5_000,
      }),
    ).resolves.toMatchObject({ status: "posted", paymentId: "pay_retry" });
    expect(rawDb.$transaction).toHaveBeenCalledTimes(2);
  });
});

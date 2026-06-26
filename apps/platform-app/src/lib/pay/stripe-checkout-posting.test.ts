import type { PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";

import { postStripeCheckoutSessionPayment } from "./stripe-checkout-posting";

vi.mock("@/lib/platform-log", () => ({
  platformLog: vi.fn(),
}));

vi.mock("@/lib/pay/plan-installment-allocation", () => ({
  allocatePaymentToPlanInstallments: vi.fn(async () => undefined),
}));

function checkoutSession(amountTotal: number): Stripe.Checkout.Session {
  return {
    id: "cs_test_123",
    amount_total: amountTotal,
    metadata: {
      tenantId: "tenant_1",
      statementId: "stmt_1",
    },
  } as Stripe.Checkout.Session;
}

describe("postStripeCheckoutSessionPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps posted ledger amount to the locked statement balance", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pay_1" }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "stmt_1" }]),
      statement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "stmt_1",
          balanceCents: 2500,
          status: "open",
        }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (cb) => cb(tx)),
    } as unknown as PrismaClient;

    await postStripeCheckoutSessionPayment({
      db,
      session: checkoutSession(10000),
      stripeEventId: "evt_1",
    });

    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 2500,
        status: "posted",
        stripeCheckoutSessionId: "cs_test_123",
      }),
    });
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt_1" },
      data: { balanceCents: 0, status: "paid" },
    });
    expect(allocatePaymentToPlanInstallments).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ amountCents: 2500, paymentId: "pay_1" }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          capturedAmountCents: 10000,
          appliedCents: 2500,
          overpaymentCents: 7500,
        }),
      }),
    });
  });

  it("records a processed session without posting money when balance is already zero", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pay_1" }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: "stmt_1" }]),
      statement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "stmt_1",
          balanceCents: 0,
          status: "paid",
        }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
    };
    const db = {
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (cb) => cb(tx)),
    } as unknown as PrismaClient;

    await postStripeCheckoutSessionPayment({
      db,
      session: checkoutSession(10000),
      stripeEventId: "evt_1",
    });

    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amountCents: 0,
        status: "overpayment_review",
      }),
    });
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt_1" },
      data: { balanceCents: 0, status: "paid" },
    });
  });

  it("throws when the transaction fails before a payment is recorded", async () => {
    const db = {
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    } as unknown as PrismaClient;

    await expect(
      postStripeCheckoutSessionPayment({
        db,
        session: checkoutSession(10000),
        stripeEventId: "evt_1",
      }),
    ).rejects.toThrow("database unavailable");
  });
});

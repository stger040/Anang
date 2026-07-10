import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { allocatePaymentToPlanInstallments } from "./plan-installment-allocation";
import { postStripeCheckoutPayment } from "./stripe-checkout-posting";

vi.mock("./plan-installment-allocation", () => ({
  allocatePaymentToPlanInstallments: vi.fn(),
}));

describe("postStripeCheckoutPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps posted payment and plan allocation to the current statement balance", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "pay1" }),
      },
      statement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "stmt1",
          tenantId: "t1",
          balanceCents: 6_000,
          status: "open",
        }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const db = {
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (fn) => fn(tx)),
    } as unknown as PrismaClient;

    const result = await postStripeCheckoutPayment({
      db,
      tenantId: "t1",
      statementId: "stmt1",
      stripeCheckoutSessionId: "cs_test_1",
      stripeEventId: "evt_1",
      capturedAmountCents: 10_000,
      requestId: "req_1",
    });

    expect(result).toMatchObject({
      status: "posted",
      paymentId: "pay1",
      capturedAmountCents: 10_000,
      appliedAmountCents: 6_000,
      overpaymentCents: 4_000,
      balanceBeforeCents: 6_000,
      balanceAfterCents: 0,
    });
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "t1",
        statementId: "stmt1",
        amountCents: 6_000,
        stripeCheckoutSessionId: "cs_test_1",
      }),
    });
    expect(tx.statement.update).toHaveBeenCalledWith({
      where: { id: "stmt1" },
      data: { balanceCents: 0, status: "paid" },
    });
    expect(allocatePaymentToPlanInstallments).toHaveBeenCalledWith(tx, {
      tenantId: "t1",
      statementId: "stmt1",
      paymentId: "pay1",
      amountCents: 6_000,
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          amountCents: 6_000,
          capturedAmountCents: 10_000,
          appliedAmountCents: 6_000,
          overpaymentCents: 4_000,
          stripeCheckoutSessionId: "cs_test_1",
          stripeEventId: "evt_1",
          requestId: "req_1",
        }),
      }),
    });
  });

  it("does not create a posted payment when the statement has no remaining balance", async () => {
    const tx = {
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      statement: {
        findFirst: vi.fn().mockResolvedValue({
          id: "stmt1",
          tenantId: "t1",
          balanceCents: 0,
          status: "paid",
        }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const db = {
      payment: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (fn) => fn(tx)),
    } as unknown as PrismaClient;

    const result = await postStripeCheckoutPayment({
      db,
      tenantId: "t1",
      statementId: "stmt1",
      stripeCheckoutSessionId: "cs_test_2",
      stripeEventId: "evt_2",
      capturedAmountCents: 10_000,
    });

    expect(result).toEqual({
      status: "nothing_to_apply",
      capturedAmountCents: 10_000,
      appliedAmountCents: 0,
      overpaymentCents: 10_000,
      balanceBeforeCents: 0,
      balanceAfterCents: 0,
    });
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.statement.update).not.toHaveBeenCalled();
    expect(allocatePaymentToPlanInstallments).not.toHaveBeenCalled();
  });
});

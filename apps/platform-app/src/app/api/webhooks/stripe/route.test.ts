import type { PrismaClient } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { postStripeCheckoutPayment } from "@/lib/pay/stripe-checkout-posting";

function createPaymentHarness(args: { balanceCents: number; installmentAmountCents?: number }) {
  const statement = {
    id: "stmt1",
    tenantId: "t1",
    balanceCents: args.balanceCents,
    status: "open",
  };
  const payments: Array<{ id: string; amountCents: number; stripeCheckoutSessionId: string }> =
    [];
  const installment =
    args.installmentAmountCents == null
      ? null
      : {
          id: "inst1",
          amountCents: args.installmentAmountCents,
          satisfiedCents: 0,
          status: "scheduled",
          paymentId: null,
        };

  const tx = {
    $queryRaw: vi.fn(async () => []),
    payment: {
      findFirst: vi.fn(async ({ where }: { where: { stripeCheckoutSessionId: string } }) => {
        return (
          payments.find((p) => p.stripeCheckoutSessionId === where.stripeCheckoutSessionId) ??
          null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const payment = {
          id: `pay${payments.length + 1}`,
          amountCents: data.amountCents,
          stripeCheckoutSessionId: data.stripeCheckoutSessionId,
        };
        payments.push(payment);
        return payment;
      }),
    },
    statement: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        where.id === statement.id && where.tenantId === statement.tenantId
          ? { ...statement }
          : null,
      ),
      update: vi.fn(async ({ data }) => {
        statement.balanceCents = data.balanceCents;
        statement.status = data.status;
        return { ...statement };
      }),
    },
    statementPaymentPlan: {
      findFirst: vi.fn(async () =>
        installment
          ? {
              id: "plan1",
              tenantId: "t1",
              statementId: "stmt1",
              installments: [{ ...installment }],
            }
          : null,
      ),
    },
    paymentPlanInstallment: {
      update: vi.fn(async ({ data }) => {
        if (installment) {
          installment.satisfiedCents = data.satisfiedCents;
          installment.status = data.status;
          installment.paymentId = data.paymentId;
        }
        return installment;
      }),
    },
    auditEvent: { create: vi.fn() },
  };

  const db = {
    $transaction: vi.fn(async (fn) => fn(tx)),
  } as unknown as PrismaClient;

  return { db, tx, statement, payments, installment };
}

describe("postStripeCheckoutPayment", () => {
  it("does not post a second checkout session after the statement is paid", async () => {
    const h = createPaymentHarness({ balanceCents: 10_000 });

    const first = await postStripeCheckoutPayment({
      db: h.db,
      tenantId: "t1",
      statementId: "stmt1",
      sessionId: "cs_first",
      amountTotal: 10_000,
      stripeEventId: "evt_first",
    });
    const second = await postStripeCheckoutPayment({
      db: h.db,
      tenantId: "t1",
      statementId: "stmt1",
      sessionId: "cs_second",
      amountTotal: 10_000,
      stripeEventId: "evt_second",
    });

    expect(first).toMatchObject({ status: "posted", appliedCents: 10_000 });
    expect(second).toEqual({ status: "nothing_to_apply" });
    expect(h.payments).toHaveLength(1);
    expect(h.payments[0]?.amountCents).toBe(10_000);
    expect(h.statement.balanceCents).toBe(0);
    expect(h.tx.statement.update).toHaveBeenCalledTimes(1);
    expect(h.tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("caps statement posting and installment allocation to the remaining balance", async () => {
    const h = createPaymentHarness({
      balanceCents: 6_000,
      installmentAmountCents: 10_000,
    });

    const result = await postStripeCheckoutPayment({
      db: h.db,
      tenantId: "t1",
      statementId: "stmt1",
      sessionId: "cs_overpay",
      amountTotal: 10_000,
      stripeEventId: "evt_overpay",
    });

    expect(result).toMatchObject({
      status: "posted",
      appliedCents: 6_000,
      overpaymentCents: 4_000,
    });
    expect(h.payments).toHaveLength(1);
    expect(h.payments[0]?.amountCents).toBe(6_000);
    expect(h.statement.balanceCents).toBe(0);
    expect(h.installment?.satisfiedCents).toBe(6_000);
    expect(h.tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            capturedAmountCents: 10_000,
            appliedCents: 6_000,
            overpaymentCents: 4_000,
          }),
        }),
      }),
    );
  });
});

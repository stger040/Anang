import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";
import type { PrismaClient } from "@prisma/client";

export type StripeCheckoutPostingResult =
  | {
      status: "posted";
      paymentId: string;
      capturedAmountCents: number;
      appliedAmountCents: number;
      overpaymentCents: number;
      balanceBeforeCents: number;
      balanceAfterCents: number;
    }
  | { status: "duplicate"; capturedAmountCents: number; appliedAmountCents: 0; overpaymentCents: 0 }
  | {
      status: "statement_not_found";
      capturedAmountCents: number;
      appliedAmountCents: 0;
      overpaymentCents: 0;
    }
  | {
      status: "nothing_to_apply";
      capturedAmountCents: number;
      appliedAmountCents: 0;
      overpaymentCents: number;
      balanceBeforeCents: number;
      balanceAfterCents: number;
    };

export async function postStripeCheckoutPayment(args: {
  db: PrismaClient;
  tenantId: string;
  statementId: string;
  stripeCheckoutSessionId: string;
  stripeEventId: string;
  capturedAmountCents: number;
  requestId?: string;
}): Promise<StripeCheckoutPostingResult> {
  const {
    db,
    tenantId,
    statementId,
    stripeCheckoutSessionId,
    stripeEventId,
    capturedAmountCents,
    requestId,
  } = args;

  if (capturedAmountCents <= 0) {
    return {
      status: "nothing_to_apply",
      capturedAmountCents,
      appliedAmountCents: 0,
      overpaymentCents: 0,
      balanceBeforeCents: 0,
      balanceAfterCents: 0,
    };
  }

  const existing = await db.payment.findFirst({
    where: { stripeCheckoutSessionId },
  });
  if (existing) {
    return {
      status: "duplicate",
      capturedAmountCents,
      appliedAmountCents: 0,
      overpaymentCents: 0,
    };
  }

  let result: StripeCheckoutPostingResult | undefined;
  await db.$transaction(async (tx) => {
    const dup = await tx.payment.findFirst({
      where: { stripeCheckoutSessionId },
    });
    if (dup) {
      result = {
        status: "duplicate",
        capturedAmountCents,
        appliedAmountCents: 0,
        overpaymentCents: 0,
      };
      return;
    }

    await tx.$queryRaw`
      SELECT id FROM "Statement"
      WHERE id = ${statementId} AND "tenantId" = ${tenantId}
      FOR UPDATE
    `;

    const stmt = await tx.statement.findFirst({
      where: { id: statementId, tenantId },
    });
    if (!stmt) {
      result = {
        status: "statement_not_found",
        capturedAmountCents,
        appliedAmountCents: 0,
        overpaymentCents: 0,
      };
      return;
    }

    const balanceBeforeCents = Math.max(0, stmt.balanceCents);
    const appliedAmountCents = Math.min(capturedAmountCents, balanceBeforeCents);
    const overpaymentCents = Math.max(0, capturedAmountCents - appliedAmountCents);
    const balanceAfterCents = balanceBeforeCents - appliedAmountCents;

    if (appliedAmountCents <= 0) {
      result = {
        status: "nothing_to_apply",
        capturedAmountCents,
        appliedAmountCents: 0,
        overpaymentCents,
        balanceBeforeCents,
        balanceAfterCents,
      };
      return;
    }

    const payment = await tx.payment.create({
      data: {
        tenantId,
        statementId,
        amountCents: appliedAmountCents,
        status: "posted",
        method: "stripe",
        paidAt: new Date(),
        stripeCheckoutSessionId,
      },
    });

    await tx.statement.update({
      where: { id: statementId },
      data: {
        balanceCents: balanceAfterCents,
        status: balanceAfterCents === 0 ? "paid" : stmt.status,
      },
    });

    await allocatePaymentToPlanInstallments(tx, {
      tenantId,
      statementId,
      paymentId: payment.id,
      amountCents: appliedAmountCents,
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorUserId: null,
        action: "pay.stripe.payment_posted",
        resource: "payment",
        metadata: {
          paymentId: payment.id,
          statementId,
          amountCents: appliedAmountCents,
          capturedAmountCents,
          appliedAmountCents,
          overpaymentCents,
          stripeCheckoutSessionId,
          stripeEventId,
          ...(requestId ? { requestId } : {}),
        },
      },
    });

    result = {
      status: "posted",
      paymentId: payment.id,
      capturedAmountCents,
      appliedAmountCents,
      overpaymentCents,
      balanceBeforeCents,
      balanceAfterCents,
    };
  });

  if (!result) {
    throw new Error("Stripe checkout posting transaction did not produce a result");
  }
  return result;
}

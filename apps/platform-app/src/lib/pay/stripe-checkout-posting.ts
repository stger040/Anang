import type { Prisma, PrismaClient } from "@prisma/client";

import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";

export type StripePaymentPostResult =
  | {
      status: "posted";
      paymentId: string;
      appliedCents: number;
      overpaymentCents: number;
    }
  | { status: "duplicate" | "statement_not_found" | "nothing_to_apply" };

export async function postStripeCheckoutPayment(args: {
  db: PrismaClient;
  tenantId: string;
  statementId: string;
  sessionId: string;
  amountTotal: number;
  stripeEventId: string;
  requestId?: string;
}): Promise<StripePaymentPostResult> {
  const { db, tenantId, statementId, sessionId, amountTotal, stripeEventId, requestId } =
    args;

  return db.$transaction(async (tx) => {
    const dup = await tx.payment.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
    });
    if (dup) return { status: "duplicate" };

    await lockStatementForPayment(tx, tenantId, statementId);

    const stmt = await tx.statement.findFirst({
      where: { id: statementId, tenantId },
    });
    if (!stmt) return { status: "statement_not_found" };

    const appliedCents = Math.min(amountTotal, Math.max(0, stmt.balanceCents));
    if (appliedCents <= 0) {
      return { status: "nothing_to_apply" };
    }

    const overpaymentCents = Math.max(0, amountTotal - appliedCents);
    const newBalance = stmt.balanceCents - appliedCents;

    const payment = await tx.payment.create({
      data: {
        tenantId,
        statementId,
        amountCents: appliedCents,
        status: "posted",
        method: "stripe",
        paidAt: new Date(),
        stripeCheckoutSessionId: sessionId,
      },
    });

    await tx.statement.update({
      where: { id: statementId },
      data: {
        balanceCents: newBalance,
        status: newBalance === 0 ? "paid" : stmt.status,
      },
    });

    await allocatePaymentToPlanInstallments(tx, {
      tenantId,
      statementId,
      paymentId: payment.id,
      amountCents: appliedCents,
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
          amountCents: appliedCents,
          capturedAmountCents: amountTotal,
          appliedCents,
          overpaymentCents,
          stripeCheckoutSessionId: sessionId,
          stripeEventId,
          ...(requestId ? { requestId } : {}),
        },
      },
    });

    return {
      status: "posted",
      paymentId: payment.id,
      appliedCents,
      overpaymentCents,
    };
  });
}

async function lockStatementForPayment(
  tx: Prisma.TransactionClient,
  tenantId: string,
  statementId: string,
) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "Statement"
    WHERE "id" = ${statementId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
}

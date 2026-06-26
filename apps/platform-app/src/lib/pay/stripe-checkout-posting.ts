import { platformLog } from "@/lib/platform-log";
import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";
import { Prisma, type PrismaClient } from "@prisma/client";
import type Stripe from "stripe";

type Db = PrismaClient;

export class StripeCheckoutPostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeCheckoutPostingError";
  }
}

export async function postStripeCheckoutSessionPayment(args: {
  db: Db;
  session: Stripe.Checkout.Session;
  requestId?: string;
  stripeEventId: string;
}): Promise<void> {
  const { db, session, requestId, stripeEventId } = args;
  const sessionId = session.id;
  const tenantId = session.metadata?.tenantId;
  const statementId = session.metadata?.statementId;
  if (!tenantId || !statementId) {
    platformLog("warn", "pay.stripe.checkout_completed.bad_metadata", {
      requestId,
      stripeCheckoutSessionId: sessionId,
    });
    throw new StripeCheckoutPostingError("Stripe checkout session missing tenant or statement metadata");
  }

  const amountTotal = session.amount_total ?? 0;
  if (amountTotal <= 0) return;

  const existing = await db.payment.findFirst({
    where: { stripeCheckoutSessionId: sessionId },
  });
  if (existing) return;

  try {
    await db.$transaction(async (tx) => {
      const dup = await tx.payment.findFirst({
        where: { stripeCheckoutSessionId: sessionId },
      });
      if (dup) return;

      const locked = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "Statement" WHERE id = ${statementId} AND "tenantId" = ${tenantId} FOR UPDATE`,
      );
      if (locked.length === 0) {
        platformLog("warn", "pay.stripe.statement_not_found_in_webhook", {
          requestId,
          tenantId,
          statementId,
          stripeCheckoutSessionId: sessionId,
        });
        throw new StripeCheckoutPostingError("Statement not found for Stripe checkout session");
      }

      const stmt = await tx.statement.findFirst({
        where: { id: statementId, tenantId },
      });
      if (!stmt) {
        throw new StripeCheckoutPostingError("Statement disappeared after Stripe webhook lock");
      }

      const appliedCents = Math.min(amountTotal, Math.max(0, stmt.balanceCents));
      const overpaymentCents = amountTotal - appliedCents;
      const newBalance = Math.max(0, stmt.balanceCents - appliedCents);

      const payment = await tx.payment.create({
        data: {
          tenantId,
          statementId,
          amountCents: appliedCents,
          status: appliedCents > 0 ? "posted" : "overpayment_review",
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

      platformLog(overpaymentCents > 0 ? "warn" : "info", "pay.stripe.payment_posted", {
        requestId,
        tenantId,
        statementId,
        paymentId: payment.id,
        stripeCheckoutSessionId: sessionId,
        amountCents: appliedCents,
        capturedAmountCents: amountTotal,
        overpaymentCents,
      });
    });
  } catch (e) {
    const stillThere = await db.payment.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
    });
    if (stillThere) return;

    platformLog("error", "pay.stripe.webhook_transaction_failed", {
      requestId,
      stripeCheckoutSessionId: sessionId,
      tenantId,
      statementId,
      message: e instanceof Error ? e.message : "unknown",
    });
    throw e instanceof Error
      ? e
      : new StripeCheckoutPostingError("Stripe checkout posting failed");
  }
}

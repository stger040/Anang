import { platformLog, readRequestId } from "@/lib/platform-log";
import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";
import { calculateStatementPaymentApplication } from "@/lib/pay/statement-payment-application";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    platformLog("warn", "stripe.webhook.verify_failed", {
      requestId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  platformLog("info", "stripe.webhook.received", {
    requestId,
    stripeEventId: event.id,
    type: event.type,
  });

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(
      event.data.object as Stripe.Checkout.Session,
      requestId,
      event.id,
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  requestId: string | undefined,
  stripeEventId: string,
) {
  const sessionId = session.id;
  const tenantId = session.metadata?.tenantId;
  const statementId = session.metadata?.statementId;
  const orgSlug = session.metadata?.orgSlug?.trim();
  if (!tenantId || !statementId) {
    platformLog("warn", "pay.stripe.checkout_completed.bad_metadata", {
      requestId,
      stripeCheckoutSessionId: sessionId,
    });
    return;
  }

  const db = orgSlug ? tenantPrisma(orgSlug) : prisma;

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

      const stmt = await lockStatementForStripePayment(tx, {
        tenantId,
        statementId,
      });
      if (!stmt) {
        platformLog("warn", "pay.stripe.statement_not_found_in_webhook", {
          requestId,
          tenantId,
          statementId,
          stripeCheckoutSessionId: sessionId,
        });
        return;
      }

      const application = calculateStatementPaymentApplication({
        currentBalanceCents: stmt.balanceCents,
        capturedCents: amountTotal,
      });

      const payment = await tx.payment.create({
        data: {
          tenantId,
          statementId,
          amountCents: amountTotal,
          status: "posted",
          method: "stripe",
          paidAt: new Date(),
          stripeCheckoutSessionId: sessionId,
        },
      });

      await tx.statement.update({
        where: { id: statementId },
        data: {
          balanceCents: application.nextBalanceCents,
          status: application.nextBalanceCents === 0 ? "paid" : stmt.status,
        },
      });

      await allocatePaymentToPlanInstallments(tx, {
        tenantId,
        statementId,
        paymentId: payment.id,
        amountCents: application.appliedCents,
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
            amountCents: amountTotal,
            appliedCents: application.appliedCents,
            overpaymentCents: application.overpaymentCents,
            stripeCheckoutSessionId: sessionId,
            stripeEventId,
            ...(requestId ? { requestId } : {}),
          },
        },
      });

      platformLog("info", "pay.stripe.payment_posted", {
        requestId,
        tenantId,
        statementId,
        paymentId: payment.id,
        stripeCheckoutSessionId: sessionId,
        amountCents: amountTotal,
        appliedCents: application.appliedCents,
        overpaymentCents: application.overpaymentCents,
      });
    });
  } catch (e) {
    const stillThere = await db.payment.findFirst({
      where: { stripeCheckoutSessionId: sessionId },
    });
    if (!stillThere) {
      platformLog("error", "pay.stripe.webhook_transaction_failed", {
        requestId,
        stripeCheckoutSessionId: sessionId,
        tenantId,
        statementId,
        message: e instanceof Error ? e.message : "unknown",
      });
    }
  }
}

async function lockStatementForStripePayment(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; statementId: string },
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Statement"
    WHERE id = ${args.statementId}
      AND "tenantId" = ${args.tenantId}
    FOR UPDATE
  `;
  if (rows.length === 0) return null;

  return tx.statement.findFirst({
    where: { id: args.statementId, tenantId: args.tenantId },
  });
}

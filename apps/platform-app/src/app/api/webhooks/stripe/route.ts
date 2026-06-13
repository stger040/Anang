import { platformLog, readRequestId } from "@/lib/platform-log";
import { postStripeCheckoutPayment } from "@/lib/pay/stripe-checkout-posting";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import { NextResponse } from "next/server";
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
    const result = await postStripeCheckoutPayment({
      db,
      tenantId,
      statementId,
      sessionId,
      amountTotal,
      stripeEventId,
      requestId,
    });

    if (result.status === "statement_not_found") {
      platformLog("warn", "pay.stripe.statement_not_found_in_webhook", {
        requestId,
        tenantId,
        statementId,
        stripeCheckoutSessionId: sessionId,
      });
    } else if (result.status === "nothing_to_apply") {
      platformLog("warn", "pay.stripe.checkout_completed_nothing_to_apply", {
        requestId,
        tenantId,
        statementId,
        stripeCheckoutSessionId: sessionId,
        capturedAmountCents: amountTotal,
      });
    } else if (result.status === "posted") {
      platformLog("info", "pay.stripe.payment_posted", {
        requestId,
        tenantId,
        statementId,
        paymentId: result.paymentId,
        stripeCheckoutSessionId: sessionId,
        capturedAmountCents: amountTotal,
        appliedCents: result.appliedCents,
        overpaymentCents: result.overpaymentCents,
      });
    }
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

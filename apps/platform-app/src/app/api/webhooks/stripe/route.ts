import { platformLog, readRequestId } from "@/lib/platform-log";
import { postStripeCheckoutSessionPayment } from "@/lib/pay/stripe-checkout-posting";
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
    try {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
        requestId,
        event.id,
      );
    } catch {
      return NextResponse.json(
        { error: "Webhook processing failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  requestId: string | undefined,
  stripeEventId: string,
) {
  const tenantId = session.metadata?.tenantId;
  const statementId = session.metadata?.statementId;
  const orgSlug = session.metadata?.orgSlug?.trim();
  if (!tenantId || !statementId) {
    await postStripeCheckoutSessionPayment({
      db: prisma,
      session,
      requestId,
      stripeEventId,
    });
    return;
  }

  const db = orgSlug ? tenantPrisma(orgSlug) : prisma;
  await postStripeCheckoutSessionPayment({
    db,
    session,
    requestId,
    stripeEventId,
  });
}

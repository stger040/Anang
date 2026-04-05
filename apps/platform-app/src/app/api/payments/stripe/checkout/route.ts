import { platformLog, readRequestId } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { getAppOrigin, getStripe } from "@/lib/stripe-server";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Creates a Stripe Checkout Session for the **current balance** on a statement (test mode).
 * Requires STRIPE_SECRET_KEY and NEXT_PUBLIC_APP_ORIGIN (or VERCEL_URL) for redirects.
 */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured (missing STRIPE_SECRET_KEY)" },
      { status: 503 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    orgSlug?: string;
    statementId?: string;
  };
  const orgSlug = body.orgSlug?.trim();
  const statementId = body.statementId?.trim();
  if (!orgSlug || !statementId) {
    return NextResponse.json(
      { error: "orgSlug and statementId required" },
      { status: 400 },
    );
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = tenantPrisma(orgSlug);
  const tenant = await db.tenant.findUnique({
    where: { slug: orgSlug },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const stmt = await db.statement.findFirst({
    where: { id: statementId, tenantId: tenant.id },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  if (stmt.balanceCents <= 0) {
    return NextResponse.json(
      { error: "Nothing to pay on this statement" },
      { status: 400 },
    );
  }

  const origin = getAppOrigin();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/o/${orgSlug}/pay/statements/${statementId}/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/o/${orgSlug}/pay/statements/${statementId}`,
    metadata: {
      tenantId: tenant.id,
      statementId: stmt.id,
      orgSlug,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: stmt.balanceCents,
          product_data: {
            name: `Statement ${stmt.number}`,
            description: `Balance due · ${tenant.displayName}`,
          },
        },
      },
    ],
  });

  if (!checkout.url) {
    platformLog("error", "pay.checkout.no_url", {
      requestId,
      tenantId: tenant.id,
      orgSlug,
      statementId: stmt.id,
      stripeCheckoutSessionId: checkout.id,
    });
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 },
    );
  }

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: session.userId,
      action: "pay.stripe.checkout_initiated",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        stripeCheckoutSessionId: checkout.id,
        amountCents: stmt.balanceCents,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "pay.checkout.created", {
    requestId,
    tenantId: tenant.id,
    orgSlug,
    statementId: stmt.id,
    stripeCheckoutSessionId: checkout.id,
    amountCents: stmt.balanceCents,
  });

  return NextResponse.json({ url: checkout.url });
}

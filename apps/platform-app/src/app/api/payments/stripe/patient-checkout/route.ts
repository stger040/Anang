import { platformLog, readRequestId } from "@/lib/platform-log";
import {
  PATIENT_PAY_GATE_COOKIE,
  getCookieFromRequest,
  verifyPatientPayGateCookie,
} from "@/lib/patient-pay-gate";
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { getAppOrigin, getStripe } from "@/lib/stripe-server";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Public (magic link): create Stripe Checkout for the statement bound to the token.
 * POST JSON: `{ token: string }` — token must be valid and org must have PAY enabled.
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

  let body: { token?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = body.token?.trim();
  if (!rawToken) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const claims = verifyPatientPayToken(rawToken);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 401 },
    );
  }

  const gate = getCookieFromRequest(req, PATIENT_PAY_GATE_COOKIE);
  if (!verifyPatientPayGateCookie(gate, rawToken)) {
    return NextResponse.json(
      { error: "Confirm your identity on the statement page first." },
      { status: 403 },
    );
  }

  const db = tenantPrisma(claims.orgSlug);
  const tenant = await db.tenant.findUnique({
    where: { slug: claims.orgSlug },
    include: {
      moduleEntitlements: {
        where: { module: ModuleKey.PAY, enabled: true },
      },
    },
  });
  if (!tenant || tenant.moduleEntitlements.length === 0) {
    return NextResponse.json({ error: "Pay is not available" }, { status: 403 });
  }

  const stmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
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
  const encToken = encodeURIComponent(rawToken);
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/p/${encodeURIComponent(claims.orgSlug)}/pay/${encToken}/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/p/${encodeURIComponent(claims.orgSlug)}/pay/${encToken}`,
    metadata: {
      tenantId: tenant.id,
      statementId: stmt.id,
      orgSlug: claims.orgSlug,
      patientPay: "1",
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
    platformLog("error", "pay.patient_checkout.no_url", {
      requestId,
      tenantId: tenant.id,
      statementId: stmt.id,
    });
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 },
    );
  }

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: null,
      action: "pay.stripe.patient_checkout_initiated",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        stripeCheckoutSessionId: checkout.id,
        amountCents: stmt.balanceCents,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "pay.patient_checkout.created", {
    requestId,
    tenantId: tenant.id,
    orgSlug: claims.orgSlug,
    statementId: stmt.id,
    stripeCheckoutSessionId: checkout.id,
  });

  return NextResponse.json({ url: checkout.url });
}

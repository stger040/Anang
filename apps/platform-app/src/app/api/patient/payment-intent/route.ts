import { platformLog, readRequestId } from "@/lib/platform-log";
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe-server";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

/**
 * POST /api/patient/payment-intent
 * Authorization: Bearer <magic-link-token>
 * Body: { amountCents: number, statementId?: string }
 *
 * Creates a Stripe PaymentIntent for use with @stripe/stripe-react-native.
 * Returns { clientSecret } which the mobile app passes to the Stripe SDK.
 */
export async function POST(req: Request) {
  // 10 payment attempts per minute per IP
  const limited = await applyRateLimit(req, "patient-payment-intent", 10, 60);
  if (limited) return limited;

  const requestId = readRequestId(req);

  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const claims = verifyPatientPayToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  let body: { amountCents?: number; statementId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.amountCents || body.amountCents < 50) {
    return NextResponse.json({ error: "amountCents must be at least 50 (Stripe minimum)" }, { status: 400 });
  }

  const db = tenantPrisma(claims.orgSlug);

  const tenant = await db.tenant.findUnique({
    where: { slug: claims.orgSlug },
    include: {
      moduleEntitlements: { where: { module: ModuleKey.PAY, enabled: true } },
    },
  });
  if (!tenant || tenant.moduleEntitlements.length === 0) {
    return NextResponse.json({ error: "Patient Pay is not enabled for this organization" }, { status: 403 });
  }

  const statementId = body.statementId ?? claims.statementId;

  // Verify statement belongs to this patient
  const anchorStmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    select: { patientId: true },
  });
  if (!anchorStmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const stmt = await db.statement.findFirst({
    where: { id: statementId, tenantId: tenant.id, patientId: anchorStmt.patientId },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const amountCents = Math.min(body.amountCents, stmt.balanceCents);

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      tenantId: tenant.id,
      statementId: stmt.id,
      orgSlug: claims.orgSlug,
      patientPay: "1",
      channel: "mobile",
    },
  });

  await db.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: null,
      action: "pay.stripe.mobile_payment_intent_created",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        stripePaymentIntentId: intent.id,
        amountCents,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "pay.patient_mobile.payment_intent_created", {
    requestId,
    tenantId: tenant.id,
    statementId: stmt.id,
    amountCents,
  });

  return NextResponse.json({ clientSecret: intent.client_secret });
}

import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim() || null;
}

/**
 * POST /api/patient/acknowledge-plan
 * Authorization: Bearer <magic-link-token>
 * Body: { planId: string }
 *
 * Marks a payment plan as acknowledged by the patient (offered → acknowledged).
 */
export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const claims = verifyPatientPayToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  let body: { planId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const planId = body.planId?.trim();
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
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

  // Verify plan belongs to the patient's statement
  const anchorStmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    select: { patientId: true },
  });
  if (!anchorStmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const plan = await db.statementPaymentPlan.findFirst({
    where: {
      id: planId,
      statement: { tenantId: tenant.id, patientId: anchorStmt.patientId },
    },
  });
  if (!plan) {
    return NextResponse.json({ error: "Payment plan not found" }, { status: 404 });
  }
  if (plan.status !== "offered") {
    return NextResponse.json({ error: `Plan is already ${plan.status}` }, { status: 409 });
  }

  await db.statementPaymentPlan.update({
    where: { id: planId },
    data: { status: "acknowledged" },
  });

  return NextResponse.json({ ok: true });
}

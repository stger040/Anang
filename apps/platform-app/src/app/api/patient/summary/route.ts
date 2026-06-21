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
 * GET /api/patient/summary
 * Authorization: Bearer <magic-link-token>
 *
 * Returns all statements for the patient associated with the token's statement,
 * plus org name and total balance.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  const claims = verifyPatientPayToken(token);
  if (!claims) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
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

  // Resolve patient from the token's statement
  const anchorStmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    select: { patientId: true },
  });
  if (!anchorStmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const statements = await db.statement.findMany({
    where: { patientId: anchorStmt.patientId, tenantId: tenant.id },
    include: {
      paymentPlan: { select: { id: true, status: true, perInstallmentCents: true, installmentCount: true, intervalWeeks: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalOwedCents = statements.reduce((sum, s) => sum + (s.balanceCents ?? 0), 0);

  return NextResponse.json({
    orgSlug: claims.orgSlug,
    orgName: tenant.displayName,
    totalOwedCents,
    statements: statements.map((s) => ({
      id: s.id,
      number: s.number,
      totalCents: s.totalCents,
      amountDueCents: s.balanceCents,
      dueDateIso: s.dueDate?.toISOString() ?? null,
      status: s.status,
      paymentPlan: s.paymentPlan
        ? {
            id: s.paymentPlan.id,
            status: s.paymentPlan.status,
            perInstallmentCents: s.paymentPlan.perInstallmentCents,
            installmentCount: s.paymentPlan.installmentCount,
            intervalWeeks: s.paymentPlan.intervalWeeks,
          }
        : null,
    })),
  });
}

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
 * GET /api/patient/statement?id=<statementId>
 * Authorization: Bearer <magic-link-token>
 *
 * Returns detailed view of a single statement: lines, payments, payment plan.
 * Defaults to the statement embedded in the token if ?id is omitted.
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

  const url = new URL(req.url);
  const statementId = url.searchParams.get("id") ?? claims.statementId;

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

  // Verify the requested statement belongs to the same patient as the token's statement
  const anchorStmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    select: { patientId: true },
  });
  if (!anchorStmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const stmt = await db.statement.findFirst({
    where: { id: statementId, tenantId: tenant.id, patientId: anchorStmt.patientId },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      paymentPlan: true,
      patient: {
        include: {
          coverages: {
            where: { status: "active" },
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          },
        },
      },
    },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const coverage = stmt.patient.coverages[0] ?? null;

  return NextResponse.json({
    id: stmt.id,
    number: stmt.number,
    totalCents: stmt.totalCents,
    amountDueCents: stmt.balanceCents,
    dueDateIso: stmt.dueDate?.toISOString() ?? null,
    status: stmt.status,
    charges: stmt.lines.map((l) => ({
      id: l.id,
      code: l.code,
      description: l.description,
      amountCents: l.amountCents,
    })),
    payments: stmt.payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      method: p.method,
      paidAt: p.paidAt?.toISOString() ?? null,
      status: p.status,
    })),
    paymentPlan: stmt.paymentPlan
      ? {
          id: stmt.paymentPlan.id,
          status: stmt.paymentPlan.status,
          installmentCount: stmt.paymentPlan.installmentCount,
          intervalWeeks: stmt.paymentPlan.intervalWeeks,
          perInstallmentCents: stmt.paymentPlan.perInstallmentCents,
        }
      : null,
    coverage: coverage
      ? {
          planName: coverage.planName,
          memberId: coverage.memberId,
          groupNumber: coverage.groupNumber,
          payerName: coverage.payerName,
          effectiveFrom: coverage.effectiveFrom?.toISOString() ?? null,
          effectiveTo: coverage.effectiveTo?.toISOString() ?? null,
        }
      : null,
  });
}

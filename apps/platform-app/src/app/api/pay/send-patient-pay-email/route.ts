import {
  PATIENT_PAY_DEFAULT_TTL_SEC,
  createPatientPayToken,
  patientPayStatementUrl,
} from "@/lib/patient-pay-token";
import { sendPatientPayLinkEmail } from "@/lib/patient-pay-email";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/stripe-server";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function usd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/**
 * Staff: mint patient pay URL and email it (Resend / SendGrid when configured).
 * POST JSON: `{ orgSlug, statementId, toEmail, ttlHours?: number }`
 */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    orgSlug?: string;
    statementId?: string;
    toEmail?: string;
    ttlHours?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug = body.orgSlug?.trim();
  const statementId = body.statementId?.trim();
  const toEmail = body.toEmail?.trim().toLowerCase();
  if (!orgSlug || !statementId || !toEmail) {
    return NextResponse.json(
      { error: "orgSlug, statementId, and toEmail required" },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(toEmail)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = tenantPrisma(orgSlug);
  const stmt = await db.statement.findFirst({
    where: { id: statementId, tenantId: ctx.tenant.id },
    include: { patient: true },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }
  if (stmt.balanceCents <= 0) {
    return NextResponse.json(
      { error: "Statement has no balance to pay online" },
      { status: 400 },
    );
  }

  const ttlSec =
    typeof body.ttlHours === "number" && body.ttlHours > 0 && body.ttlHours <= 720
      ? Math.floor(body.ttlHours * 3600)
      : PATIENT_PAY_DEFAULT_TTL_SEC;

  let token: string;
  try {
    token = createPatientPayToken({
      orgSlug,
      statementId: stmt.id,
      ttlSec,
    });
  } catch (e) {
    platformLog("error", "pay.send_patient_email.mint_failed", {
      requestId,
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "Cannot mint link (set PATIENT_PAY_LINK_SECRET or AUTH_SECRET on the server)",
      },
      { status: 503 },
    );
  }

  const origin = getAppOrigin();
  const payUrl = patientPayStatementUrl({ origin, orgSlug, token });

  const delivery = await sendPatientPayLinkEmail({
    to: toEmail,
    payUrl,
    tenantDisplayName: ctx.tenant.displayName,
    patientFirstName: stmt.patient.firstName,
    statementNumber: stmt.number,
    amountDueLabel: usd(stmt.balanceCents),
    ttlSec,
  });

  await db.auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "pay.patient_pay_email.requested",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        delivery: delivery.status,
        ...(delivery.status === "failed"
          ? { message: delivery.message }
          : {}),
        toEmailDomain: toEmail.split("@")[1] ?? "unknown",
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "pay.send_patient_email.done", {
    requestId,
    tenantId: ctx.tenant.id,
    orgSlug,
    statementId: stmt.id,
    delivery: delivery.status,
  });

  if (delivery.status === "failed") {
    return NextResponse.json(
      { error: delivery.message, url: payUrl },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    delivery: delivery.status,
    url: payUrl,
  });
}

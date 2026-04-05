import {
  PATIENT_PAY_DEFAULT_TTL_SEC,
  createPatientPayToken,
  patientPayStatementUrl,
} from "@/lib/patient-pay-token";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { sendPatientPaySmsViaTwilio } from "@/lib/sms-twilio";
import { getAppOrigin } from "@/lib/stripe-server";
import { getSession } from "@/lib/session";
import {
  isWithinSmsQuietHours,
  parseTenantMessagingSettings,
} from "@/lib/tenant-messaging-settings";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

const E164_RE = /^\+[1-9]\d{6,14}$/;

function patientAllowsBillingSms(patient: {
  billingSmsOptInAt: Date | null;
  billingSmsOptOutAt: Date | null;
}): boolean {
  if (!patient.billingSmsOptInAt) return false;
  if (
    patient.billingSmsOptOutAt &&
    patient.billingSmsOptOutAt > patient.billingSmsOptInAt
  ) {
    return false;
  }
  return true;
}

/**
 * Staff: mint patient pay URL and SMS it (Twilio when configured).
 * POST JSON: `{ orgSlug, statementId, toE164, ttlHours?: number }`
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
    toE164?: string;
    ttlHours?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug = body.orgSlug?.trim();
  const statementId = body.statementId?.trim();
  const toE164 = body.toE164?.trim() ?? "";
  if (!orgSlug || !statementId || !toE164) {
    return NextResponse.json(
      { error: "orgSlug, statementId, and toE164 required" },
      { status: 400 },
    );
  }
  if (!E164_RE.test(toE164)) {
    return NextResponse.json(
      {
        error:
          "Phone must be E.164 (e.g. +15551234567) for carrier delivery.",
      },
      { status: 400 },
    );
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = tenantPrisma(orgSlug);
  const tenantRow = await db.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { settings: true },
  });
  const messagingSettings = parseTenantMessagingSettings(tenantRow?.settings);

  const stmt = await db.statement.findFirst({
    where: { id: statementId, tenantId: ctx.tenant.id },
    include: { patient: true },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  if (!patientAllowsBillingSms(stmt.patient)) {
    return NextResponse.json(
      {
        error:
          "Patient has no billing SMS consent on file (opt-in required, opt-out honored).",
      },
      { status: 400 },
    );
  }
  if (stmt.balanceCents <= 0) {
    return NextResponse.json(
      { error: "Statement has no balance to pay online" },
      { status: 400 },
    );
  }

  const ttlSec =
    typeof body.ttlHours === "number" &&
    body.ttlHours > 0 &&
    body.ttlHours <= 720
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
    platformLog("error", "pay.send_patient_sms.mint_failed", {
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

  if (
    messagingSettings?.smsQuietHours &&
    isWithinSmsQuietHours(new Date(), messagingSettings.smsQuietHours)
  ) {
    platformLog("info", "pay.send_patient_sms.quiet_hours_skip", {
      requestId,
      tenantId: ctx.tenant.id,
      statementId: stmt.id,
    });
    return NextResponse.json({
      ok: true,
      delivery: "quiet_hours",
      url: payUrl,
      message:
        "Skipped send during tenant quiet hours (settings.messaging.smsQuietHours).",
    });
  }
  const bodyText = [
    `${ctx.tenant.displayName}: your bill is ready.`,
    `Amount due: $${(stmt.balanceCents / 100).toFixed(2)}`,
    `Pay securely: ${payUrl}`,
  ].join(" ");

  const smsRes = await sendPatientPaySmsViaTwilio({
    toE164,
    body:
      bodyText.length > 1450 ? `${bodyText.slice(0, 1440)}…` : bodyText,
    requestId,
    ...(messagingSettings?.twilio
      ? { twilioOverride: messagingSettings.twilio }
      : {}),
  });

  await db.auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "pay.patient_pay_sms.requested",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        smsResult:
          smsRes.sent === true
            ? "sent"
            : smsRes.skipped
              ? "skipped"
              : "failed",
        ...(smsRes.sent === false && !smsRes.skipped && "error" in smsRes
          ? { message: smsRes.error }
          : {}),
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  if (smsRes.sent) {
    return NextResponse.json({
      ok: true,
      delivery: "sent",
      url: payUrl,
    });
  }

  if (smsRes.skipped) {
    return NextResponse.json({
      ok: true,
      delivery: "skipped",
      url: payUrl,
    });
  }

  return NextResponse.json(
    { error: "error" in smsRes ? smsRes.error : "SMS failed", url: payUrl },
    { status: 502 },
  );
}

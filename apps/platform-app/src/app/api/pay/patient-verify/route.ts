import { platformLog, readRequestId } from "@/lib/platform-log";
import {
  PATIENT_PAY_GATE_COOKIE,
  PATIENT_PAY_GATE_MAX_AGE_SEC,
  patientMatchesVerificationFactors,
  signPatientPayGateCookie,
} from "@/lib/patient-pay-gate";
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Public: after opening magic link, patient confirms DOB and/or account last-4.
 * Sets httpOnly cookie for same-site API calls (`path=/`).
 */
export async function POST(req: Request) {
  const requestId = readRequestId(req);

  let body: {
    token?: string;
    dob?: string;
    accountLast4?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const claims = verifyPatientPayToken(token);
  if (!claims) {
    return NextResponse.json(
      { error: "Invalid or expired link" },
      { status: 401 },
    );
  }

  const db = tenantPrisma(claims.orgSlug);
  const stmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenant: { slug: claims.orgSlug } },
    include: { patient: true },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const ok = patientMatchesVerificationFactors({
    dob: stmt.patient.dob,
    mrn: stmt.patient.mrn,
    dobInput: body.dob,
    accountLast4Input: body.accountLast4,
  });
  if (!ok) {
    platformLog("warn", "pay.patient_verify.failed", {
      requestId,
      tenantId: stmt.tenantId,
      statementId: stmt.id,
    });
    return NextResponse.json(
      { error: "That doesn’t match our records. Try again or call billing." },
      { status: 403 },
    );
  }

  const signed = signPatientPayGateCookie(token);
  if (!signed) {
    return NextResponse.json(
      { error: "Server cannot issue session (missing AUTH_SECRET)" },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(PATIENT_PAY_GATE_COOKIE, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PATIENT_PAY_GATE_MAX_AGE_SEC,
  });

  await db.patientPortalIdentity.upsert({
    where: { patientId: stmt.patient.id },
    create: {
      tenantId: stmt.tenantId,
      patientId: stmt.patient.id,
      lastSessionVerifiedAt: new Date(),
    },
    update: { lastSessionVerifiedAt: new Date() },
  });

  platformLog("info", "pay.patient_verify.ok", {
    requestId,
    tenantId: stmt.tenantId,
    statementId: stmt.id,
  });

  return NextResponse.json({ ok: true });
}

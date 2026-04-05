import { explainStatementLine } from "@/lib/bill-line-explain";
import { platformLog, readRequestId } from "@/lib/platform-log";
import {
  PATIENT_PAY_GATE_COOKIE,
  getCookieFromRequest,
  verifyPatientPayGateCookie,
} from "@/lib/patient-pay-gate";
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/** POST JSON: `{ token, lineId }` — valid magic link; PAY module must be enabled. */
export async function POST(req: Request) {
  const requestId = readRequestId(req);

  let body: { token?: string; lineId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawToken = body.token?.trim();
  const lineId = body.lineId?.trim();
  if (!rawToken || !lineId) {
    return NextResponse.json(
      { error: "token and lineId required" },
      { status: 400 },
    );
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const line = await db.statementLine.findFirst({
    where: {
      id: lineId,
      statementId: claims.statementId,
      statement: { tenantId: tenant.id },
    },
    select: {
      code: true,
      description: true,
      amountCents: true,
    },
  });

  if (!line) {
    return NextResponse.json({ error: "Line not found" }, { status: 404 });
  }

  const result = await explainStatementLine({
    code: line.code,
    description: line.description,
    amountCents: line.amountCents,
  });

  platformLog("info", "pay.patient_line_explain.completed", {
    tenantId: tenant.id,
    orgSlug: claims.orgSlug,
    statementId: claims.statementId,
    lineId,
    source: result.source,
    ...(requestId ? { requestId } : {}),
  });

  return NextResponse.json({
    ok: true,
    text: result.text,
    source: result.source,
  });
}

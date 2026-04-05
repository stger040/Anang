import {
  PATIENT_PAY_DEFAULT_TTL_SEC,
  createPatientPayToken,
  patientPayStatementUrl,
} from "@/lib/patient-pay-token";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { getAppOrigin } from "@/lib/stripe-server";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * Staff-authenticated: mint a time-limited patient pay URL for one statement.
 * POST JSON: `{ orgSlug, statementId, ttlHours?: number }`
 */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orgSlug?: string; statementId?: string; ttlHours?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

  const stmt = await prisma.statement.findFirst({
    where: { id: statementId, tenantId: ctx.tenant.id },
    select: { id: true, balanceCents: true },
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

  let token: string;
  try {
    const ttlHours = body.ttlHours;
    const ttlSec =
      typeof ttlHours === "number" && ttlHours > 0 && ttlHours <= 720
        ? Math.floor(ttlHours * 3600)
        : PATIENT_PAY_DEFAULT_TTL_SEC;
    token = createPatientPayToken({
      orgSlug,
      statementId: stmt.id,
      ttlSec,
    });
  } catch (e) {
    platformLog("error", "pay.patient_link.mint_failed", {
      requestId,
      orgSlug,
      statementId,
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
  const url = patientPayStatementUrl({ origin, orgSlug, token });

  await prisma.auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "pay.patient_link.issued",
      resource: "statement",
      metadata: {
        statementId: stmt.id,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "pay.patient_link.issued", {
    requestId,
    tenantId: ctx.tenant.id,
    orgSlug,
    statementId: stmt.id,
  });

  return NextResponse.json({ url, token });
}

import { explainStatementLine } from "@/lib/bill-line-explain";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/** POST JSON: `{ orgSlug, statementId, lineId }` — staff session; PAY module required. */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orgSlug?: string; statementId?: string; lineId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug = body.orgSlug?.trim();
  const statementId = body.statementId?.trim();
  const lineId = body.lineId?.trim();
  if (!orgSlug || !statementId || !lineId) {
    return NextResponse.json(
      { error: "orgSlug, statementId, and lineId required" },
      { status: 400 },
    );
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const line = await prisma.statementLine.findFirst({
    where: {
      id: lineId,
      statementId,
      statement: { tenantId: ctx.tenant.id },
    },
    select: {
      code: true,
      description: true,
      amountCents: true,
      statementId: true,
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

  platformLog("info", "pay.line_explain.completed", {
    tenantId: ctx.tenant.id,
    orgSlug,
    statementId,
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

import { explainStatementLine } from "@/lib/bill-line-explain";
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
 * POST /api/patient/ask-ai
 * Authorization: Bearer <magic-link-token>
 * Body: { question: string, lineId?: string }
 *
 * Answers a patient's billing question. If lineId is provided, explains that
 * specific charge line. Otherwise generates a general answer about the statement.
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

  let body: { question?: string; lineId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
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

  const stmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    include: { lines: true },
  });
  if (!stmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  // If a specific line was asked about, explain that line
  if (body.lineId) {
    const line = stmt.lines.find((l) => l.id === body.lineId);
    if (!line) {
      return NextResponse.json({ error: "Charge line not found" }, { status: 404 });
    }
    const result = await explainStatementLine({
      code: line.code ?? "",
      description: line.description ?? "",
      amountCents: line.amountCents,
    });
    return NextResponse.json({ answer: result.explanation });
  }

  // General question — explain the most expensive line as a proxy, or summarize
  const topLine = stmt.lines.sort((a, b) => b.amountCents - a.amountCents)[0];
  if (topLine) {
    const result = await explainStatementLine({
      code: topLine.code ?? "",
      description: topLine.description ?? "",
      amountCents: topLine.amountCents,
    });
    return NextResponse.json({
      answer: `${result.explanation}\n\nFor more help with your bill, please call our billing team.`,
    });
  }

  return NextResponse.json({
    answer:
      "This statement has no itemized charges on file. Please call our billing team and they can walk you through every line.",
  });
}

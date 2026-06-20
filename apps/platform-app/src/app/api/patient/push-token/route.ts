import { NextRequest, NextResponse } from "next/server";
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // 5 token registrations per minute per IP
  const limited = await applyRateLimit(req, "patient-push-token", 5, 60);
  if (limited) return limited;

  const authHeader = req.headers.get("authorization") ?? "";
  const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  const claims = verifyPatientPayToken(rawToken);
  if (!claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = tenantPrisma(claims.orgSlug);

  // Resolve tenant and patient from the token's statement
  const tenant = await db.tenant.findUnique({ where: { slug: claims.orgSlug } });
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const anchorStmt = await db.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    select: { patientId: true },
  });
  if (!anchorStmt) {
    return NextResponse.json({ error: "Statement not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const { token } = body as { token?: string };
  if (!token || typeof token !== "string" || !token.startsWith("ExponentPushToken[")) {
    return NextResponse.json({ error: "Invalid Expo push token" }, { status: 400 });
  }

  await db.patientExpoPushToken.upsert({
    where: { tenantId_token: { tenantId: tenant.id, token } },
    create: { tenantId: tenant.id, patientId: anchorStmt.patientId, token },
    update: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

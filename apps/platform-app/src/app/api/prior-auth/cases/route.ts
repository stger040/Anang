import { auth } from "@/auth";
import { tenantPrisma } from "@/lib/prisma";
import { assertOrgAccess } from "@/lib/tenant-context";
import type { PriorAuthCaseCreateBody } from "@/lib/prior-auth/prior-auth-api-contract";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * TODO: Replace 501 with full JSON list + pagination once API auth is finalized.
 * Contract: `PriorAuthCaseListQuery` in `@/lib/prior-auth/prior-auth-api-contract`.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("orgSlug")?.trim();
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }
  const payload = {
    userId: session.user.id,
    email: session.user.email,
    appRole: session.user.appRole!,
  };
  const ctx = await assertOrgAccess(payload, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.CONNECT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rows = await tenantPrisma(orgSlug).priorAuthCase.findMany({
    where: { tenantId: ctx.tenant.id },
    take: 50,
    orderBy: { updatedAt: "desc" },
    select: { id: true, caseNumber: true, status: true, payerName: true, updatedAt: true },
  });
  return NextResponse.json({ cases: rows, stub: false });
}

/** TODO: POST body validation + shared create mutation for external callers. */
export async function POST(req: Request) {
  void ((await req.json()) as unknown as PriorAuthCaseCreateBody);
  return NextResponse.json(
    { error: "Not implemented — use Connect Authorizations UI or server actions for Phase 1." },
    { status: 501 },
  );
}

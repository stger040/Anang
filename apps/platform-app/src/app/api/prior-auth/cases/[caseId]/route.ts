import { auth } from "@/auth";
import { tenantPrisma } from "@/lib/prisma";
import { assertOrgAccess } from "@/lib/tenant-context";
import type { PriorAuthCasePatchBody } from "@/lib/prior-auth/prior-auth-api-contract";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/**
 * TODO: PATCH uses `PriorAuthCasePatchBody` — delegate to `updatePriorAuthCaseStatusDb` with API auth.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get("orgSlug")?.trim();
  const { caseId } = await ctx.params;
  if (!orgSlug) {
    return NextResponse.json({ error: "orgSlug required" }, { status: 400 });
  }
  const payload = {
    userId: session.user.id,
    email: session.user.email,
    appRole: session.user.appRole!,
  };
  const ac = await assertOrgAccess(payload, orgSlug);
  if (!ac?.effectiveModules.has(ModuleKey.CONNECT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const row = await tenantPrisma(orgSlug).priorAuthCase.findFirst({
    where: { id: caseId, tenantId: ac.tenant.id },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      services: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ case: row });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ caseId: string }> },
) {
  void (await ctx.params);
  void ((await req.json()) as unknown as PriorAuthCasePatchBody);
  return NextResponse.json(
    { error: "Not implemented — use Connect detail page or server actions for Phase 1." },
    { status: 501 },
  );
}

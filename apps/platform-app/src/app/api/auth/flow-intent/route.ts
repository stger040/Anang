import { NextResponse } from "next/server";

import {
  INTENDED_ORG_COOKIE,
  PENDING_INVITE_COOKIE,
  authFlowCookieDefaults,
  authFlowCookieSecure,
} from "@/lib/auth-flow-cookies";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";

export const dynamic = "force-dynamic";

type Body = {
  intendedOrgSlug?: string | null;
  pendingInviteToken?: string | null;
};

export async function POST(req: Request) {
  const requestId = readRequestId(req);
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    platformLog("warn", "auth.flow_intent.bad_body", {
      ...(requestId ? { requestId } : {}),
    });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  const base = authFlowCookieDefaults();

  let intendedTenantId: string | undefined;
  const orgRaw =
    typeof body.intendedOrgSlug === "string" ? body.intendedOrgSlug.trim() : "";
  if (orgRaw) {
    const slug = validateTenantSlug(orgRaw);
    if (slug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (tenant) {
        intendedTenantId = tenant.id;
        res.cookies.set(INTENDED_ORG_COOKIE, slug, base);
      }
    }
  }

  const inviteRaw =
    typeof body.pendingInviteToken === "string"
      ? body.pendingInviteToken.trim()
      : "";
  const inviteCookieSet =
    inviteRaw.length >= 16 && inviteRaw.length <= 512;
  if (inviteCookieSet) {
    res.cookies.set(PENDING_INVITE_COOKIE, inviteRaw, {
      ...base,
      secure: authFlowCookieSecure(),
    });
  }

  platformLog("info", "auth.flow_intent.stored", {
    ...(requestId ? { requestId } : {}),
    ...(intendedTenantId ? { tenantId: intendedTenantId } : {}),
    intendedOrgStored: !!intendedTenantId,
    inviteCookieSet,
  });

  return res;
}

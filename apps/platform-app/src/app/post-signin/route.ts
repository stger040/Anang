import { auth } from "@/auth";
import {
  INTENDED_ORG_COOKIE,
  PENDING_INVITE_COOKIE,
  authFlowCookieDefaults,
} from "@/lib/auth-flow-cookies";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import { postSignInTenantPath } from "@/lib/adaptive-workspace";
import { fulfillInviteForUser } from "@/lib/user-invite";
import { AppRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Cookie mutation is only allowed in Route Handlers — not in `page.tsx` RSC (throws in production). */
function clearAuthFlowCookies(res: NextResponse) {
  const base = { ...authFlowCookieDefaults(), maxAge: 0 };
  res.cookies.set(PENDING_INVITE_COOKIE, "", base);
  res.cookies.set(INTENDED_ORG_COOKIE, "", base);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = request.nextUrl;
  const inviteFromQuery = searchParams.get("invite")?.trim() || undefined;
  const inviteFromCookie = request.cookies
    .get(PENDING_INVITE_COOKIE)
    ?.value?.trim();
  const inviteToken = inviteFromQuery || inviteFromCookie;

  const orgFromQuery = searchParams.get("org")?.trim() || undefined;
  const orgFromCookie = request.cookies
    .get(INTENDED_ORG_COOKIE)
    ?.value?.trim();
  const intendedOrgRaw = orgFromQuery || orgFromCookie;

  const emailLower = session.user.email.toLowerCase();

  if (inviteToken) {
    const requestId = await readRequestIdFromHeaders();
    const r = await fulfillInviteForUser(
      inviteToken,
      session.user.id,
      emailLower,
      requestId ? { requestId } : undefined,
    );
    const sessionPayload = {
      userId: session.user.id,
      email: emailLower,
      appRole: session.user.appRole ?? AppRole.STAFF,
    };
    const res = r.ok
      ? NextResponse.redirect(
          new URL(
            await postSignInTenantPath(sessionPayload, r.tenantSlug),
            request.url,
          ),
        )
      : r.code === "email_mismatch"
        ? NextResponse.redirect(
            new URL("/login?error=invite_email_mismatch", request.url),
          )
        : NextResponse.redirect(new URL("/login?error=invite_invalid", request.url));
    clearAuthFlowCookies(res);
    return res;
  }

  if (session.user.appRole === AppRole.SUPER_ADMIN) {
    if (intendedOrgRaw) {
      const slug = validateTenantSlug(intendedOrgRaw);
      if (slug) {
        const tenant = await prisma.tenant.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (tenant) {
          const sessionPayload = {
            userId: session.user.id,
            email: emailLower,
            appRole: session.user.appRole!,
          };
          const path = await postSignInTenantPath(sessionPayload, slug);
          const res = NextResponse.redirect(new URL(path, request.url));
          clearAuthFlowCookies(res);
          return res;
        }
      }
    }
    const res = NextResponse.redirect(new URL("/admin", request.url));
    clearAuthFlowCookies(res);
    return res;
  }

  if (intendedOrgRaw) {
    const slug = validateTenantSlug(intendedOrgRaw);
    if (slug) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { id: true, slug: true },
      });
      if (tenant) {
        const m = await prisma.membership.findUnique({
          where: {
            userId_tenantId: { userId: session.user.id, tenantId: tenant.id },
          },
          include: { tenant: { select: { slug: true } } },
        });
        if (m) {
          const sessionPayload = {
            userId: session.user.id,
            email: emailLower,
            appRole: session.user.appRole!,
          };
          const path = await postSignInTenantPath(sessionPayload, m.tenant.slug);
          const res = NextResponse.redirect(new URL(path, request.url));
          clearAuthFlowCookies(res);
          return res;
        }
      }
    }
  }

  const m = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { tenant: { select: { slug: true } } },
    orderBy: { id: "asc" },
  });

  if (m) {
    const sessionPayload = {
      userId: session.user.id,
      email: emailLower,
      appRole: session.user.appRole!,
    };
    const path = await postSignInTenantPath(sessionPayload, m.tenant.slug);
    const res = NextResponse.redirect(new URL(path, request.url));
    clearAuthFlowCookies(res);
    return res;
  }

  const res = NextResponse.redirect(
    new URL("/login?error=no_org", request.url),
  );
  clearAuthFlowCookies(res);
  return res;
}

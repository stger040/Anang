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
import { credentialsSessionAllowedForTenantSlug } from "@/lib/tenant-auth-queries";
import { fulfillInviteForUser } from "@/lib/user-invite";
import type { SessionPayload } from "@/lib/session";
import { AppRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Cookie mutation is only allowed in Route Handlers — not in `page.tsx` RSC (throws in production). */
function clearAuthFlowCookies(res: NextResponse) {
  const base = { ...authFlowCookieDefaults(), maxAge: 0 };
  res.cookies.set(PENDING_INVITE_COOKIE, "", base);
  res.cookies.set(INTENDED_ORG_COOKIE, "", base);
}

function sessionPayloadFromAuth(session: {
  user: {
    id: string;
    email: string;
    appRole?: AppRole;
    authViaCredentials?: boolean;
  };
}): SessionPayload {
  return {
    userId: session.user.id,
    email: session.user.email.toLowerCase(),
    appRole: session.user.appRole ?? AppRole.STAFF,
    ...(session.user.authViaCredentials ? { authViaCredentials: true } : {}),
  };
}

async function redirectIntoTenantOrSsoRequired(
  request: NextRequest,
  sessionPayload: SessionPayload,
  tenantSlug: string,
): Promise<NextResponse> {
  const allowed = await credentialsSessionAllowedForTenantSlug(tenantSlug, {
    isSuperAdmin: sessionPayload.appRole === AppRole.SUPER_ADMIN,
    authViaCredentials: sessionPayload.authViaCredentials === true,
  });
  if (!allowed) {
    const res = NextResponse.redirect(
      new URL(
        `/login?org=${encodeURIComponent(tenantSlug)}&error=password_sso_required`,
        request.url,
      ),
    );
    clearAuthFlowCookies(res);
    return res;
  }
  const path = await postSignInTenantPath(sessionPayload, tenantSlug);
  const res = NextResponse.redirect(new URL(path, request.url));
  clearAuthFlowCookies(res);
  return res;
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
  const sessionPayload = sessionPayloadFromAuth({
    user: {
      id: session.user.id,
      email: emailLower,
      appRole: session.user.appRole,
      authViaCredentials: session.user.authViaCredentials,
    },
  });

  if (inviteToken) {
    const requestId = await readRequestIdFromHeaders();
    const r = await fulfillInviteForUser(
      inviteToken,
      session.user.id,
      emailLower,
      requestId ? { requestId } : undefined,
    );
    if (!r.ok) {
      const res =
        r.code === "email_mismatch"
          ? NextResponse.redirect(
              new URL("/login?error=invite_email_mismatch", request.url),
            )
          : NextResponse.redirect(
              new URL("/login?error=invite_invalid", request.url),
            );
      clearAuthFlowCookies(res);
      return res;
    }
    return redirectIntoTenantOrSsoRequired(request, sessionPayload, r.tenantSlug);
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
          return redirectIntoTenantOrSsoRequired(request, sessionPayload, slug);
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
          return redirectIntoTenantOrSsoRequired(
            request,
            sessionPayload,
            m.tenant.slug,
          );
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
    return redirectIntoTenantOrSsoRequired(
      request,
      sessionPayload,
      m.tenant.slug,
    );
  }

  const res = NextResponse.redirect(
    new URL("/login?error=no_org", request.url),
  );
  clearAuthFlowCookies(res);
  return res;
}

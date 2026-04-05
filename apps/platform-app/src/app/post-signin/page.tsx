import { auth } from "@/auth";
import {
  INTENDED_ORG_COOKIE,
  PENDING_INVITE_COOKIE,
} from "@/lib/auth-flow-cookies";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { fulfillInviteForUser } from "@/lib/user-invite";
import { AppRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * After OAuth / credentials, NextAuth lands here so we can route by app role + membership.
 * Honors `?org=` and `?invite=` (or short-lived cookies when IdP omits query params).
 */
export default async function PostSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; invite?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const inviteFromQuery =
    typeof sp.invite === "string" && sp.invite.trim()
      ? sp.invite.trim()
      : undefined;
  const inviteFromCookie = cookieStore.get(PENDING_INVITE_COOKIE)?.value?.trim();
  const inviteToken = inviteFromQuery || inviteFromCookie;

  const orgFromQuery =
    typeof sp.org === "string" && sp.org.trim() ? sp.org.trim() : undefined;
  const orgFromCookie = cookieStore.get(INTENDED_ORG_COOKIE)?.value?.trim();
  const intendedOrgRaw = orgFromQuery || orgFromCookie;

  cookieStore.delete(PENDING_INVITE_COOKIE);
  cookieStore.delete(INTENDED_ORG_COOKIE);

  const emailLower = session.user.email.toLowerCase();

  if (inviteToken) {
    const requestId = await readRequestIdFromHeaders();
    const r = await fulfillInviteForUser(
      inviteToken,
      session.user.id,
      emailLower,
      requestId ? { requestId } : undefined,
    );
    if (r.ok) {
      redirect(`/o/${r.tenantSlug}/dashboard`);
    }
    if (r.code === "email_mismatch") {
      redirect("/login?error=invite_email_mismatch");
    }
    redirect("/login?error=invite_invalid");
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
          redirect(`/o/${slug}/dashboard`);
        }
      }
    }
    redirect("/admin");
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
          redirect(`/o/${m.tenant.slug}/dashboard`);
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
    redirect(`/o/${m.tenant.slug}/dashboard`);
  }

  redirect("/login?error=no_org");
}

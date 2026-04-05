import { auth } from "@/auth";
import { getBrand } from "@anang/brand";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";
import { redirect } from "next/navigation";

import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { fulfillInviteForUser, loadInvitePreview } from "@/lib/user-invite";
import { AppRole } from "@prisma/client";

export const dynamic = "force-dynamic";

function loginHref(token: string, orgSlug: string): string {
  const q = new URLSearchParams({ invite: token, org: orgSlug });
  return `/login?${q.toString()}`;
}

export default async function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await loadInvitePreview(token);
  const b = getBrand();

  if (!preview.ok) {
    const msg =
      preview.code === "consumed"
        ? "This invitation has already been used."
        : preview.code === "expired"
          ? "This invitation has expired. Ask your administrator for a new link."
          : "This invitation link is not valid.";
    return (
      <div className="mx-auto min-h-screen max-w-lg px-4 py-16">
        <p className="text-sm font-semibold text-slate-900">{b.company.displayName}</p>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Invitation</h1>
        <p className="mt-2 text-sm text-slate-600">{msg}</p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-medium text-brand-navy underline"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const session = await auth();
  if (session?.user?.email && session.user.id) {
    const emailOk =
      session.user.email.toLowerCase() === preview.email.toLowerCase();
    if (emailOk) {
      const requestId = await readRequestIdFromHeaders();
      const r = await fulfillInviteForUser(
        token,
        session.user.id,
        session.user.email.toLowerCase(),
        requestId ? { requestId } : undefined,
      );
      if (r.ok) {
        redirect(`/o/${r.tenantSlug}/dashboard`);
      }
      const errMsg =
        r.code === "consumed"
          ? "This invite was already used."
          : r.code === "expired"
            ? "This invite has expired."
            : r.code === "email_mismatch"
              ? "Session email does not match this invite."
              : "Could not apply this invite.";
      return (
        <div className="mx-auto min-h-screen max-w-lg px-4 py-16">
          <h1 className="text-xl font-semibold text-slate-900">Invitation</h1>
          <p className="mt-2 text-sm text-amber-900">{errMsg}</p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-brand-navy underline"
          >
            Sign in
          </Link>
        </div>
      );
    }
    return (
      <div className="mx-auto min-h-screen max-w-lg px-4 py-16">
        <h1 className="text-xl font-semibold text-slate-900">
          Wrong account
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This invitation is for{" "}
          <span className="font-mono text-xs">{preview.email}</span>. You are
          signed in as someone else — sign out and use the correct account.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={loginHref(token, preview.tenantSlug)}
            className="text-sm font-medium text-brand-navy underline"
          >
            Open sign-in for this invite
          </Link>
          <SignOutButton />
        </div>
      </div>
    );
  }

  const roleLabel =
    preview.membershipRole === AppRole.TENANT_ADMIN
      ? "Tenant administrator"
      : "Staff";

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-16">
      <p className="text-sm font-semibold text-slate-900">{b.company.displayName}</p>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">
        You&apos;re invited to {preview.tenantDisplayName}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-mono text-xs">{preview.email}</span> · {roleLabel}
      </p>
      <p className="mt-4 text-sm text-slate-600">
        Sign in with that address (SSO or password). You will be added to this
        organization automatically after authentication.
      </p>
      <Link
        href={loginHref(token, preview.tenantSlug)}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-medium text-white"
      >
        Continue to sign in
      </Link>
    </div>
  );
}

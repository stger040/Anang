import { getBrand } from "@anang/brand";
import { getBookMeetingUrl, urls } from "@anang/config";
import { SignInForm } from "@/components/sign-in-form";
import { SyncAuthFlowIntent } from "@/components/sync-auth-flow-intent";
import Link from "next/link";
import {
  getTenantLoginBranding,
  globalOidcConfigured,
} from "@/lib/tenant-auth-settings";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; org?: string; invite?: string }>;
}) {
  const sp = await searchParams;
  const b = getBrand();
  const bookUrl = getBookMeetingUrl();
  const orgParam =
    typeof sp.org === "string" && sp.org.trim() ? sp.org.trim() : undefined;
  const tenantBranding = await getTenantLoginBranding(orgParam);
  const orgUnknown = !!orgParam && !tenantBranding;
  const showGlobalSso = globalOidcConfigured();
  const inviteToken =
    typeof sp.invite === "string" && sp.invite.trim().length >= 16
      ? sp.invite.trim()
      : undefined;
  const intendedOrgSlug = tenantBranding?.orgSlug;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-cream via-white to-brand-sky/30">
      <SyncAuthFlowIntent
        intendedOrgSlug={intendedOrgSlug}
        pendingInviteToken={inviteToken}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-12 sm:py-20">
        <div className="mb-10 text-center">
          <Link
            href={urls.marketing}
            className="inline-flex flex-col items-center gap-2 text-sm font-semibold text-brand-navy sm:flex-row"
          >
            <img
              src="/brand/logo-trans-light-bg.svg"
              alt={b.company.displayName}
              width={200}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Sign in
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
            Use your work email and organization sign-in method. If your team
            shared a link that includes{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">?org=…</code>,
            open that link so the correct policy and SSO options apply.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-xs text-slate-500">
            Need access? Ask your organization&apos;s Anang administrator.
            Operators: set{" "}
            <code className="rounded bg-slate-100 px-0.5 font-mono text-[11px]">
              AUTH_SECRET
            </code>{" "}
            and SSO per{" "}
            <code className="rounded bg-slate-100 px-0.5 font-mono text-[11px]">
              docs/DEPLOYMENT.md
            </code>{" "}
            in the repo.
          </p>
        </div>

        {sp.error === "forbidden" ? (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            You do not have access to that area.
          </p>
        ) : null}
        {sp.error === "no_org" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This account has no organization membership.
          </p>
        ) : null}
        {sp.error === "sso_unknown_user" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            SSO succeeded, but this email is not provisioned in Anang yet. Ask
            your administrator to add your user and tenant membership, enable
            JIT provisioning for tenant OIDC, then try again. Details:{" "}
            <code className="rounded bg-amber-100 px-1 text-xs">
              docs/CLIENT_IT_OIDC_ONBOARDING.md
            </code>
            .
          </p>
        ) : null}
        {sp.error === "sso_no_tenant_membership" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            SSO succeeded, but this account is not a member of this organization.
            Your administrator can add you in{" "}
            <span className="font-mono text-xs">/admin</span> or enable JIT
            provisioning for tenant SSO.
          </p>
        ) : null}
        {sp.error === "invite_email_mismatch" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            The signed-in email does not match your invitation. Sign out and
            sign in with the invited address, or open your invite link again.
          </p>
        ) : null}
        {sp.error === "invite_invalid" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This invitation is invalid, expired, or already used. Ask your
            administrator for a new link.
          </p>
        ) : null}

        <SignInForm
          marketingUrl={urls.marketing}
          bookMeetingUrl={bookUrl}
          showGlobalSso={showGlobalSso}
          tenantBranding={tenantBranding}
          orgUnknown={orgUnknown}
          intendedOrgSlug={intendedOrgSlug}
          pendingInviteToken={inviteToken}
        />
      </div>
    </div>
  );
}

import { getBrand } from "@anang/brand";
import { getBookMeetingUrl, urls } from "@anang/config";
import { SignInForm } from "@/components/sign-in-form";
import { SyncAuthFlowIntent } from "@/components/sync-auth-flow-intent";
import Link from "next/link";
import { getTenantLoginBranding } from "@/lib/tenant-auth-queries";
import { globalOidcConfigured } from "@/lib/tenant-auth-settings";

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
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center px-4 py-10">
      <SyncAuthFlowIntent
        intendedOrgSlug={intendedOrgSlug}
        pendingInviteToken={inviteToken}
      />
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <Link
            href={urls.marketing}
            className="inline-flex justify-center"
          >
            <img
              src="/brand/logo-trans-light-bg.svg"
              alt={b.company.displayName}
              width={720}
              height={144}
              className="h-36 w-auto max-w-full"
            />
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-8 py-8 shadow-sm sm:px-10">
          <h1 className="text-center text-xl font-semibold tracking-tight text-slate-900">
            Sign in
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm text-slate-600">
            {tenantBranding
              ? "Use your organization's sign-in method below."
              : "Use your work email and password, or single sign-on if your administrator enabled it."}
          </p>

          <div className="mt-8">
            {sp.error === "forbidden" ? (
              <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                You do not have access to that area.
              </p>
            ) : null}
            {sp.error === "no_org" ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This account has no organization membership.
              </p>
            ) : null}
            {sp.error === "sso_unknown_user" ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                SSO succeeded, but this email is not provisioned in Anang yet.
                Ask your administrator to add your account or enable JIT
                provisioning.
              </p>
            ) : null}
            {sp.error === "sso_no_tenant_membership" ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                SSO succeeded, but this account is not a member of this
                organization.
              </p>
            ) : null}
            {sp.error === "invite_email_mismatch" ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                The signed-in email does not match your invitation. Sign out and
                sign in with the invited address, or open your invite link
                again.
              </p>
            ) : null}
            {sp.error === "invite_invalid" ? (
              <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This invitation is invalid, expired, or already used.
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

        <p className="mt-6 text-center text-xs text-slate-500">
          Need access? Contact your organization&apos;s Anang administrator.
        </p>
      </div>
    </div>
  );
}

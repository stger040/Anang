"use client";

import { Button } from "@anang/ui";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import {
  ACCESS_PROFILE_OPTIONS,
  type AccessProfileId,
} from "@/lib/login-routing";
import { postSignInPath } from "@/lib/post-signin-url";
import type { TenantLoginBranding } from "@/lib/tenant-auth-settings";

const CANONICAL_VIRTUAL_EMAIL =
  process.env.NEXT_PUBLIC_PLATFORM_VIRTUAL_EMAIL?.trim().toLowerCase() ??
  process.env.NEXT_PUBLIC_DEMO_LOGIN_EMAIL?.trim().toLowerCase() ??
  "access@anang.ai";

export function SignInForm({
  marketingUrl,
  bookMeetingUrl,
  showGlobalSso,
  tenantBranding,
  orgUnknown,
  intendedOrgSlug,
  pendingInviteToken,
}: {
  marketingUrl: string;
  bookMeetingUrl: string;
  /** Platform-wide OIDC (`AUTH_OIDC_*`) — not tied to a tenant app registration */
  showGlobalSso: boolean;
  tenantBranding: TenantLoginBranding | null;
  orgUnknown: boolean;
  /** Valid tenant slug for post-auth redirect (from `?org=` when the tenant exists). */
  intendedOrgSlug?: string;
  /** From `?invite=` — carried through sign-in and tenant OIDC. */
  pendingInviteToken?: string;
}) {
  const [email, setEmail] = useState(
    () => (tenantBranding ? "" : CANONICAL_VIRTUAL_EMAIL),
  );
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<AccessProfileId>("enterprise");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isVirtualMailbox = useMemo(() => {
    return email.trim().toLowerCase() === CANONICAL_VIRTUAL_EMAIL;
  }, [email]);

  const showProfilePicker = !tenantBranding;
  const showPasswordBlock = !tenantBranding || tenantBranding.showPassword;

  const displayGlobalSso = tenantBranding
    ? tenantBranding.showGlobalSso
    : showGlobalSso;

  const afterSignIn = postSignInPath({
    intendedOrgSlug,
    pendingInviteToken,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        ...(isVirtualMailbox ? { accessProfile: profile } : {}),
        ...(tenantBranding?.orgSlug
          ? { tenantSlug: tenantBranding.orgSlug }
          : {}),
        redirect: false,
        callbackUrl: afterSignIn,
      });
      if (res?.error) {
        setError(
          tenantBranding?.policy === "sso_required"
            ? "Password sign-in is disabled for this organization. Use SSO, or open the generic sign-in link without ?org= if you are a platform operator."
            : "Invalid email, password, or profile selection.",
        );
        return;
      }
      if (res?.url) {
        window.location.href = res.url;
        return;
      }
      window.location.href = afterSignIn;
    } finally {
      setLoading(false);
    }
  }

  async function onGlobalSso() {
    setError(null);
    setLoading(true);
    try {
      await signIn("oidc", { callbackUrl: afterSignIn });
    } finally {
      setLoading(false);
    }
  }

  function onTenantSso() {
    if (!tenantBranding?.tenantSsoPath) return;
    setLoading(true);
    const invite = pendingInviteToken?.trim();
    const url =
      invite && invite.length >= 16
        ? `${tenantBranding.tenantSsoPath}?invite=${encodeURIComponent(invite)}`
        : tenantBranding.tenantSsoPath;
    window.location.href = url;
  }

  return (
    <div className="space-y-8">
      {orgUnknown ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Unknown organization in the link. Confirm the URL or ask your
          administrator for the correct sign-in page.
        </p>
      ) : null}

      {tenantBranding ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {tenantBranding.displayName}
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            {tenantBranding.orgSlug}
          </p>
          {tenantBranding.missingSsoConfig ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              SSO is expected for this tenant but OIDC is not fully configured
              yet. Your administrator must complete IdP registration and env
              secrets (see docs).
            </p>
          ) : null}
        </div>
      ) : null}

      {tenantBranding?.showTenantSso ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
            Single sign-on (this organization)
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Use your organization&apos;s identity provider. Your work email
            must match a user already created in Anang.
          </p>
          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            variant="secondary"
            disabled={loading}
            onClick={onTenantSso}
          >
            Continue with organization SSO
          </Button>
        </div>
      ) : null}

      {displayGlobalSso ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
            {tenantBranding
              ? "Single sign-on (platform IdP)"
              : "Single sign-on"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {tenantBranding
              ? "Shared app registration on this Anang deployment (AUTH_OIDC_* environment variables)."
              : "Sign in with the identity provider configured for this environment."}
          </p>
          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            variant="secondary"
            disabled={loading}
            onClick={onGlobalSso}
          >
            {tenantBranding
              ? "Continue with platform SSO"
              : "Continue with SSO"}
          </Button>
        </div>
      ) : null}

      {showPasswordBlock ? (
        <form onSubmit={onSubmit} className="space-y-8">
          {showProfilePicker ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
                Access target (internal)
              </p>
              <p className="text-sm text-slate-600">
                When using the shared access email, choose which workspace opens
                after sign-in. For customer orgs, prefer links with{" "}
                <code className="rounded bg-slate-100 px-1 text-xs">
                  ?org=your-slug
                </code>{" "}
                from your administrator.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ACCESS_PROFILE_OPTIONS.map((t) => {
                  const selected = profile === t.id;
                  const ring =
                    t.accent === "coral"
                      ? selected
                        ? "border-brand-coral bg-brand-coral/5 ring-2 ring-brand-coral/40"
                        : "border-slate-200 hover:border-brand-coral/40"
                      : selected
                        ? "border-brand-navy bg-brand-sky/40 ring-2 ring-brand-navy/25"
                        : "border-slate-200 hover:border-brand-navy/30";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setProfile(t.id);
                        setError(null);
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${ring}`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {t.title}{" "}
                        <span className="font-normal text-slate-500">
                          · {t.subtitle}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {t.description}
                      </p>
                      <p className="mt-2 text-xs font-medium text-brand-navy">
                        Opens: {t.tenantPreview}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {t.moduleSummary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
              Email & password
            </p>
            <div>
              <label
                htmlFor="signin-email"
                className="block text-xs font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
                placeholder="name@healthsystem.org"
              />
              {showProfilePicker && isVirtualMailbox ? (
                <p className="mt-1 text-xs text-slate-500">
                  Tiles above select the workspace for the shared access address.
                </p>
              ) : showProfilePicker ? (
                <p className="mt-1 text-xs text-slate-600">
                  Use the work email your administrator registered in Anang.
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="signin-password"
                className="block text-xs font-medium text-slate-700"
              >
                Password
              </label>
              <input
                id="signin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
              <p className="mt-1 text-xs text-slate-500">
                Internal deployments use{" "}
                <code className="font-mono">PLATFORM_LOGIN_PASSWORD</code> until
                you rely on SSO only.
              </p>
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </div>

          <p className="text-center text-xs text-slate-500">
            <Link className="font-medium text-brand-navy underline" href={marketingUrl}>
              {marketingUrl.replace(/^https?:\/\//, "")}
            </Link>
            {" · "}
            <a
              href={bookMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-navy underline"
            >
              Contact
            </a>
          </p>
        </form>
      ) : (
        <p className="text-sm text-slate-600">
          This organization requires single sign-on. Use the button above.
        </p>
      )}
    </div>
  );
}

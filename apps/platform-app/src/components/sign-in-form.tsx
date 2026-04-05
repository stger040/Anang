"use client";

import { Button } from "@anang/ui";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { postSignInPath } from "@/lib/post-signin-url";
import type { TenantLoginBranding } from "@/lib/tenant-auth-settings";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showPasswordBlock = !tenantBranding || tenantBranding.showPassword;

  const displayGlobalSso = tenantBranding
    ? tenantBranding.showGlobalSso
    : showGlobalSso;

  const showTenantSso = !!tenantBranding?.showTenantSso;
  const anySsoOption = showTenantSso || displayGlobalSso;

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
            : "Invalid email or password.",
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
    <div className="space-y-6">
      {orgUnknown ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Unknown organization in the link. Confirm the URL or ask your
          administrator for the correct sign-in page.
        </p>
      ) : null}

      {tenantBranding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Organization
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {tenantBranding.displayName}
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500">
            {tenantBranding.orgSlug}
          </p>
          {tenantBranding.missingSsoConfig ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              SSO is expected for this tenant but OIDC is not fully configured
              yet. Your administrator must complete IdP registration and
              environment secrets.
            </p>
          ) : null}
        </div>
      ) : null}

      {showTenantSso ? (
        <Button
          type="button"
          className="w-full justify-center"
          variant="secondary"
          disabled={loading}
          onClick={onTenantSso}
        >
          Continue with organization SSO
        </Button>
      ) : null}

      {displayGlobalSso ? (
        <Button
          type="button"
          className={`w-full justify-center ${showTenantSso ? "mt-3" : ""}`}
          variant="secondary"
          disabled={loading}
          onClick={onGlobalSso}
        >
          {tenantBranding ? "Continue with platform SSO" : "Continue with SSO"}
        </Button>
      ) : null}

      {showPasswordBlock && anySsoOption ? (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-white px-2 text-slate-400">or</span>
          </div>
        </div>
      ) : null}

      {showPasswordBlock ? (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="signin-email"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              placeholder="you@company.com"
              required
            />
          </div>
          <div>
            <label
              htmlFor="signin-password"
              className="block text-sm font-medium text-slate-700"
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
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              required
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Pilot deployments may use a shared app password (
              <code className="rounded bg-slate-100 px-1 font-mono text-[11px]">
                PLATFORM_LOGIN_PASSWORD
              </code>
              ) until SSO is enabled.
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>

          <p className="pt-2 text-center text-xs text-slate-500">
            <Link
              className="font-medium text-brand-navy hover:underline"
              href={marketingUrl}
            >
              {marketingUrl.replace(/^https?:\/\//, "")}
            </Link>
            {" · "}
            <a
              href={bookMeetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-navy hover:underline"
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

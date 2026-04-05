"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  clientSecretEnvKeyForTenantSlug,
  TENANT_AUTH_POLICIES,
  type TenantAuthPolicy,
  type TenantJitMembershipRole,
} from "@/lib/tenant-auth-settings";

import {
  type TenantAuthActionState,
  updateTenantAuthSettings,
} from "./tenant-auth-actions";

export function TenantAuthSettingsForm({
  slug,
  currentPolicy,
  currentIssuer,
  currentClientId,
  oidcRedirectUri,
  currentJitProvisioning,
  currentJitMembershipRole,
}: {
  slug: string;
  currentPolicy: TenantAuthPolicy;
  currentIssuer: string;
  currentClientId: string;
  oidcRedirectUri: string;
  currentJitProvisioning: boolean;
  currentJitMembershipRole: TenantJitMembershipRole;
}) {
  const [state, action, pending] = useActionState<
    TenantAuthActionState,
    FormData
  >(updateTenantAuthSettings, null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const envKey = clientSecretEnvKeyForTenantSlug(slug);

  useEffect(() => {
    if (state && "ok" in state && state.ok && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />

      <div>
        <label htmlFor={`auth-policy-${slug}`} className="text-xs font-medium text-slate-700">
          Authentication policy
        </label>
        <select
          id={`auth-policy-${slug}`}
          name="policy"
          defaultValue={currentPolicy}
          className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        >
          {TENANT_AUTH_POLICIES.map((p) => (
            <option key={p} value={p}>
              {p === "local_only"
                ? "Local / internal login only (no SSO for this tenant)"
                : p === "sso_allowed"
                  ? "Local + SSO (recommended for rollout)"
                  : "SSO required (password blocked when ?org= is set)"}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          JIT provisioning (tenant OIDC only)
        </p>
        <p className="mt-2 text-xs text-slate-600">
          When enabled, the first successful organization SSO sign-in may create a
          user and/or add this tenant&apos;s membership if the IdP email is new
          or only mapped to other orgs. Audit events{" "}
          <code className="font-mono text-[11px]">auth.oidc.jit_*</code> are
          written. Platform-wide SSO (<code className="font-mono text-[11px]">AUTH_OIDC_*</code>) is
          unchanged — still requires a pre-existing user.
        </p>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            name="jitProvisioning"
            defaultChecked={currentJitProvisioning}
            className="rounded border-slate-300"
          />
          Allow automatic provisioning on first tenant OIDC sign-in
        </label>
        <div className="mt-3">
          <label
            htmlFor={`jit-role-${slug}`}
            className="text-xs font-medium text-slate-700"
          >
            Membership role when JIT creates this org&apos;s membership
          </label>
          <select
            id={`jit-role-${slug}`}
            name="jitMembershipRole"
            defaultValue={currentJitMembershipRole}
            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          >
            <option value="STAFF">STAFF</option>
            <option value="TENANT_ADMIN">TENANT_ADMIN</option>
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Dedicated OIDC app (optional)
        </p>
        <p className="mt-2 text-xs text-slate-600">
          Enter the issuer and client ID from the customer&apos;s IdP. Set the
          client secret in deploy env as{" "}
          <code className="rounded bg-white px-1 font-mono text-[11px]">{envKey}</code>{" "}
          (never commit secrets). Redirect URI to register:{" "}
          <code className="mt-1 block break-all rounded bg-white px-1 font-mono text-[11px]">
            {oidcRedirectUri}
          </code>
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-700">Issuer URL</label>
            <input
              name="issuer"
              defaultValue={currentIssuer}
              placeholder="https://login.microsoftonline.com/…/v2.0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-slate-700">Client ID</label>
            <input
              name="clientId"
              defaultValue={currentClientId}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm"
            />
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" name="clearOidc" className="rounded border-slate-300" />
          Clear OIDC configuration (use platform-wide SSO env only, if configured)
        </label>
      </div>

      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none"
        >
          Auth settings saved. Redeploy or update env if you changed OIDC secrets.
        </p>
      ) : null}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving…" : "Save auth settings"}
      </Button>
      <p className="text-xs text-slate-500">
        IT checklist:{" "}
        <code className="rounded bg-slate-100 px-1">docs/CLIENT_IT_OIDC_ONBOARDING.md</code>
      </p>
    </form>
  );
}

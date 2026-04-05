/**
 * Per-tenant authentication policy and optional dedicated OIDC client.
 * Client secrets never belong in Tenant.settings — use env vars (see clientSecretEnvKey).
 */

import { AppRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";

export const TENANT_AUTH_POLICIES = [
  "local_only",
  "sso_allowed",
  "sso_required",
] as const;

export type TenantAuthPolicy = (typeof TENANT_AUTH_POLICIES)[number];

const JIT_MEMBERSHIP_ROLES = ["STAFF", "TENANT_ADMIN"] as const;
export type TenantJitMembershipRole = (typeof JIT_MEMBERSHIP_ROLES)[number];

export type TenantAuthSettingsV1 = {
  version: 1;
  policy: TenantAuthPolicy;
  /**
   * When true, valid tenant OIDC sign-in may create a `User` and/or `Membership`
   * for this tenant if the IdP email is not provisioned yet.
   */
  jitProvisioning?: boolean;
  /** Role on the membership created by JIT (never affects `User.appRole`). Default STAFF. */
  jitMembershipRole?: TenantJitMembershipRole;
  /** Tenant-specific OIDC app (preferred for production). Secret: env only. */
  oidc?: {
    issuer: string;
    clientId: string;
  };
};

const DEFAULT_POLICY: TenantAuthPolicy = "sso_allowed";

export function clientSecretEnvKeyForTenantSlug(slug: string): string {
  const key = slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `AUTH_OIDC_CLIENT_SECRET__${key}`;
}

export function parseTenantAuthSettings(raw: unknown): TenantAuthSettingsV1 {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { version: 1, policy: DEFAULT_POLICY };
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !o.policy) {
    return { version: 1, policy: DEFAULT_POLICY };
  }
  const policy = o.policy as string;
  if (!TENANT_AUTH_POLICIES.includes(policy as TenantAuthPolicy)) {
    return { version: 1, policy: DEFAULT_POLICY };
  }
  const jitProvisioning = o.jitProvisioning === true;
  let jitMembershipRole: TenantJitMembershipRole | undefined;
  const jmr = o.jitMembershipRole;
  if (typeof jmr === "string" && JIT_MEMBERSHIP_ROLES.includes(jmr as TenantJitMembershipRole)) {
    jitMembershipRole = jmr as TenantJitMembershipRole;
  }
  let oidc: TenantAuthSettingsV1["oidc"];
  const oidcRaw = o.oidc;
  if (oidcRaw && typeof oidcRaw === "object" && !Array.isArray(oidcRaw)) {
    const r = oidcRaw as Record<string, unknown>;
    const issuer = typeof r.issuer === "string" ? r.issuer.trim() : "";
    const clientId = typeof r.clientId === "string" ? r.clientId.trim() : "";
    if (issuer && clientId) {
      oidc = { issuer, clientId };
    }
  }
  return {
    version: 1,
    policy: policy as TenantAuthPolicy,
    ...(jitProvisioning ? { jitProvisioning: true } : {}),
    ...(jitMembershipRole ? { jitMembershipRole } : {}),
    ...(oidc ? { oidc } : {}),
  };
}

export function tenantJitMembershipAppRole(
  auth: TenantAuthSettingsV1,
): AppRole {
  return auth.jitMembershipRole === "TENANT_ADMIN"
    ? AppRole.TENANT_ADMIN
    : AppRole.STAFF;
}

export async function loadTenantAuthRow(slug: string) {
  const s = validateTenantSlug(slug);
  if (!s) return null;
  return prisma.tenant.findUnique({
    where: { slug: s },
    select: { id: true, slug: true, displayName: true, settings: true },
  });
}

export function globalOidcConfigured(): boolean {
  return !!(
    process.env.AUTH_OIDC_ISSUER?.trim() &&
    process.env.AUTH_OIDC_ID?.trim() &&
    process.env.AUTH_OIDC_SECRET?.trim()
  );
}

export function tenantOidcSecretFromEnv(slug: string): string | undefined {
  const k = clientSecretEnvKeyForTenantSlug(slug);
  return process.env[k]?.trim() || undefined;
}

export type TenantLoginBranding = {
  orgSlug: string;
  displayName: string;
  policy: TenantAuthPolicy;
  /** Password field when `?org=` points at this tenant */
  showPassword: boolean;
  showTenantSso: boolean;
  showGlobalSso: boolean;
  /** Dedicated tenant OIDC (issuer + client id in DB; secret in env) */
  tenantOidcReady: boolean;
  tenantSsoPath: string;
  /** Platform-wide OIDC env (shared app registration) */
  globalOidcConfigured: boolean;
  /** `sso_required` but no working SSO path for this org */
  missingSsoConfig: boolean;
};

export async function getTenantLoginBranding(
  orgSlugRaw: string | undefined,
): Promise<TenantLoginBranding | null> {
  if (!orgSlugRaw?.trim()) return null;
  const row = await loadTenantAuthRow(orgSlugRaw);
  if (!row) return null;
  const auth = parseTenantAuthSettings(
    (row.settings as Record<string, unknown>)?.auth,
  );
  const secretPresent = !!tenantOidcSecretFromEnv(row.slug);
  const tenantOidcReady = !!(
    auth.oidc?.issuer &&
    auth.oidc.clientId &&
    secretPresent
  );
  const policy = auth.policy;
  const global = globalOidcConfigured();

  const showPassword = policy !== "sso_required";

  const showTenantSso =
    policy !== "local_only" &&
    tenantOidcReady &&
    (policy === "sso_allowed" || policy === "sso_required");

  const showGlobalSso =
    policy !== "local_only" &&
    global &&
    (policy === "sso_allowed" || policy === "sso_required");

  const missingSsoConfig =
    (policy === "sso_allowed" || policy === "sso_required") &&
    !tenantOidcReady &&
    !global;

  return {
    orgSlug: row.slug,
    displayName: row.displayName,
    policy,
    showPassword,
    showTenantSso,
    showGlobalSso,
    tenantOidcReady,
    tenantSsoPath: `/api/auth/tenant-oidc/${row.slug}`,
    globalOidcConfigured: global,
    missingSsoConfig,
  };
}

/** For credentials provider: block password when signing into an org that requires SSO. */
export async function passwordAllowedForTenantSlug(
  slug: string | undefined,
): Promise<boolean> {
  if (!slug?.trim()) return true;
  const row = await loadTenantAuthRow(slug);
  if (!row) return true;
  const auth = parseTenantAuthSettings(
    (row.settings as Record<string, unknown>)?.auth,
  );
  return auth.policy !== "sso_required";
}

import { tenantPrisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import {
  globalOidcConfigured,
  parseTenantAuthSettings,
  tenantOidcSecretFromEnv,
  type TenantAuthSettingsV1,
  type TenantLoginBranding,
} from "@/lib/tenant-auth-settings";
import { AppRole } from "@prisma/client";

export function tenantJitMembershipAppRole(
  auth: TenantAuthSettingsV1,
): AppRole {
  return auth.jitMembershipRole === "TENANT_ADMIN"
    ? AppRole.TENANT_ADMIN
    : AppRole.STAFF;
}

/** Server-only: tenant row for auth policy / OIDC UI. Uses `DATABASE_URL__…` when configured for this slug. */
export async function loadTenantAuthRow(slug: string) {
  const s = validateTenantSlug(slug);
  if (!s) return null;
  return tenantPrisma(s).tenant.findUnique({
    where: { slug: s },
    select: { id: true, slug: true, displayName: true, settings: true },
  });
}

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
    auth.oidc?.clientId &&
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

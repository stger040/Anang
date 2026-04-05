/**
 * Non-secret Greenway FHIR routing in Tenant.settings (see DEPLOYMENT.md).
 * Credentials stay in env: GREENWAY_FHIR_* optionally suffixed __<SLUG>.
 */

import type { GreenwayFhirHostKind } from "./urls";
import { greenwayFhirBaseUrl } from "./urls";

export type TenantGreenwayFhirConnectorSettings = {
  /** Full FHIR API base, e.g. …/fhir/R4/{vendorTenantId} */
  baseUrl?: string;
  /** Vendor FHIR path tenant id when using default Greenway AWS hosts */
  fhirTenantId?: string;
  /** staging | production (and aliases) — pairs with fhirTenantId */
  hostEnv?: string;
};

/** Uppercase slug with non-alphanumeric → underscore (matches OIDC secret env pattern). */
export function greenwayEnvKeySuffixForTenantSlug(slug: string): string {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

function parseHostKindLocal(
  raw: string | undefined,
): GreenwayFhirHostKind | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "staging" || v === "stage" || v === "stg") {
    return "staging";
  }
  if (v === "production" || v === "prod") {
    return "production";
  }
  return null;
}

export function parseTenantGreenwayConnectorSettings(
  rawSettings: unknown,
): TenantGreenwayFhirConnectorSettings | null {
  if (!rawSettings || typeof rawSettings !== "object") return null;
  const root = rawSettings as Record<string, unknown>;
  const connectors = root.connectors;
  if (!connectors || typeof connectors !== "object") return null;
  const gw = (connectors as Record<string, unknown>).greenwayFhir;
  if (!gw || typeof gw !== "object") return null;
  const o = gw as Record<string, unknown>;
  const baseUrl =
    typeof o.baseUrl === "string" && o.baseUrl.trim()
      ? o.baseUrl.trim()
      : undefined;
  const fhirTenantId =
    typeof o.fhirTenantId === "string" && o.fhirTenantId.trim()
      ? o.fhirTenantId.trim()
      : undefined;
  const hostEnv =
    typeof o.hostEnv === "string" && o.hostEnv.trim()
      ? o.hostEnv.trim()
      : undefined;
  if (!baseUrl && !fhirTenantId) return null;
  return { baseUrl, fhirTenantId, hostEnv };
}

/**
 * Resolve FHIR base URL: tenant override → built from tenant fhirTenantId + host → global env.
 */
export function resolveGreenwayFhirBaseUrlForTenant(args: {
  tenantOverlay: TenantGreenwayFhirConnectorSettings | null;
  /** From readGreenwayFhirEnvFromProcess() or null */
  globalBaseUrl: string | null;
  /** When tenant has fhirTenantId but no hostEnv, use process env host (GREENWAY_FHIR_ENV). */
  fallbackHostKind: GreenwayFhirHostKind | null;
}): string | null {
  const t = args.tenantOverlay;
  if (t?.baseUrl) {
    return t.baseUrl.replace(/\/$/, "");
  }
  if (t?.fhirTenantId) {
    const kind =
      parseHostKindLocal(t.hostEnv) ?? args.fallbackHostKind;
    if (!kind) return null;
    return greenwayFhirBaseUrl(kind, t.fhirTenantId);
  }
  return args.globalBaseUrl;
}

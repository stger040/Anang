import type { GreenwayFhirHostKind } from "./urls";
import { greenwayFhirBaseUrl } from "./urls";
import {
  greenwayEnvKeySuffixForTenantSlug,
  parseTenantGreenwayConnectorSettings,
  resolveGreenwayFhirBaseUrlForTenant,
} from "./tenant-greenway-settings";

export type GreenwayFhirEnvConfig = {
  /** API root through tenant, e.g. …/fhir/R4/{tenantId} */
  baseUrl: string;
  /** Present when GREENWAY_FHIR_ACCESS_TOKEN (or legacy EHR_FHIR_ACCESS_TOKEN) is set — server only. */
  accessToken: string | null;
};

export function parseGreenwayFhirHostEnv(
  raw: string | undefined,
): GreenwayFhirHostKind | null {
  if (!raw) {
    return null;
  }
  const v = raw.trim().toLowerCase();
  if (v === "staging" || v === "stage" || v === "stg") {
    return "staging";
  }
  if (v === "production" || v === "prod") {
    return "production";
  }
  return null;
}

/** Global env only — base URL + host kind from GREENWAY_FHIR_* / EHR_* (no tenant.settings). */
export function readGreenwayFhirGlobalBaseContext(): {
  baseUrl: string | null;
  hostKind: GreenwayFhirHostKind | null;
} {
  const explicit =
    process.env.GREENWAY_FHIR_BASE_URL?.trim() ||
    process.env.EHR_FHIR_BASE_URL?.trim();
  const tenant =
    process.env.GREENWAY_FHIR_TENANT_ID?.trim() ||
    process.env.EHR_FHIR_TENANT_ID?.trim();
  const kind =
    parseGreenwayFhirHostEnv(process.env.GREENWAY_FHIR_ENV) ??
    parseGreenwayFhirHostEnv(process.env.EHR_FHIR_ENV);

  let baseUrl: string | null = null;
  if (explicit) {
    baseUrl = explicit.replace(/\/$/, "");
  } else if (tenant && kind) {
    baseUrl = greenwayFhirBaseUrl(kind, tenant);
  }

  return { baseUrl, hostKind: kind };
}

/**
 * Reads optional Greenway FHIR settings from the environment.
 * Returns null if no base can be resolved (tenant + host kind or explicit base URL).
 */
export function readGreenwayFhirEnvConfig(): GreenwayFhirEnvConfig | null {
  const { baseUrl } = readGreenwayFhirGlobalBaseContext();
  if (!baseUrl) {
    return null;
  }

  const accessToken =
    process.env.GREENWAY_FHIR_ACCESS_TOKEN?.trim() ||
    process.env.EHR_FHIR_ACCESS_TOKEN?.trim() ||
    null;

  return { baseUrl, accessToken };
}

/**
 * Bearer token: `GREENWAY_FHIR_ACCESS_TOKEN__<SLUG_KEY>` then global
 * `GREENWAY_FHIR_ACCESS_TOKEN` / `EHR_FHIR_ACCESS_TOKEN`.
 */
export function readGreenwayFhirAccessTokenForTenantSlug(
  tenantSlug: string,
): string | null {
  const key = greenwayEnvKeySuffixForTenantSlug(tenantSlug);
  return (
    process.env[`GREENWAY_FHIR_ACCESS_TOKEN__${key}`]?.trim() ||
    process.env.GREENWAY_FHIR_ACCESS_TOKEN?.trim() ||
    process.env.EHR_FHIR_ACCESS_TOKEN?.trim() ||
    null
  );
}

/**
 * Merges **Tenant.settings.connectors.greenwayFhir** (non-secret) with process env.
 * Use with **`resolveGreenwayFhirEnvConfigAsyncForTenant`** for OAuth per slug.
 */
export function readGreenwayFhirEnvConfigForTenant(
  tenantSlug: string,
  rawTenantSettings: unknown,
): GreenwayFhirEnvConfig | null {
  const overlay = parseTenantGreenwayConnectorSettings(rawTenantSettings);
  const global = readGreenwayFhirGlobalBaseContext();
  const baseUrl = resolveGreenwayFhirBaseUrlForTenant({
    tenantOverlay: overlay,
    globalBaseUrl: global.baseUrl,
    fallbackHostKind: global.hostKind,
  });
  if (!baseUrl) {
    return null;
  }
  const accessToken = readGreenwayFhirAccessTokenForTenantSlug(tenantSlug);
  return { baseUrl, accessToken };
}

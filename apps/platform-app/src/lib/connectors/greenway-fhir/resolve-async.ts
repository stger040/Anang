import type { GreenwayFhirEnvConfig } from "./env";
import {
  readGreenwayFhirEnvConfig,
  readGreenwayFhirEnvConfigForTenant,
} from "./env";
import {
  fetchGreenwayAccessTokenForSuffix,
  fetchGreenwayAccessTokenWithClientCredentials,
} from "./oauth-client-credentials";
import { greenwayEnvKeySuffixForTenantSlug } from "./tenant-greenway-settings";

/**
 * Same as readGreenwayFhirEnvConfig but fills accessToken via client_credentials
 * when static GREENWAY_FHIR_ACCESS_TOKEN is unset.
 */
export async function resolveGreenwayFhirEnvConfigAsync(): Promise<GreenwayFhirEnvConfig | null> {
  const cfg = readGreenwayFhirEnvConfig();
  if (!cfg) return null;
  if (cfg.accessToken) return cfg;

  const token = await fetchGreenwayAccessTokenWithClientCredentials();
  if (!token) return cfg;

  return { baseUrl: cfg.baseUrl, accessToken: token };
}

/**
 * Per-tenant base (settings + env) and OAuth **`GREENWAY_FHIR_*__SLUG`** fallbacks.
 */
export async function resolveGreenwayFhirEnvConfigAsyncForTenant(
  tenantSlug: string,
  rawTenantSettings: unknown,
): Promise<GreenwayFhirEnvConfig | null> {
  const cfg = readGreenwayFhirEnvConfigForTenant(tenantSlug, rawTenantSettings);
  if (!cfg) return null;
  if (cfg.accessToken) return cfg;

  const key = greenwayEnvKeySuffixForTenantSlug(tenantSlug);
  const token = await fetchGreenwayAccessTokenForSuffix(key);
  if (!token) return cfg;

  return { baseUrl: cfg.baseUrl, accessToken: token };
}

/**
 * Greenway Health FHIR R4 URL helpers.
 * @see https://developers.greenwayhealth.com/developer-platform/reference/getting-started-1
 */

export type GreenwayFhirHostKind = "staging" | "production";

const HOSTS: Record<GreenwayFhirHostKind, string> = {
  staging: "https://fhir-api.fhirstaging.aws.greenwayhealth.com",
  production: "https://fhir-api.fhirprod.aws.greenwayhealth.com",
};

/** FHIR R4 base including tenant segment, no trailing slash. */
export function greenwayFhirBaseUrl(
  kind: GreenwayFhirHostKind,
  tenantId: string,
): string {
  const t = tenantId.trim();
  if (!t) {
    throw new Error("Greenway FHIR tenant id is required");
  }
  const host = HOSTS[kind].replace(/\/$/, "");
  return `${host}/fhir/R4/${encodeURIComponent(t)}`;
}

/** Absolute URL for a resource type search or type-level interaction (no id). */
export function greenwayFhirTypeUrl(
  baseUrl: string,
  resourceType: string,
): string {
  const b = baseUrl.replace(/\/$/, "");
  const rt = resourceType.trim();
  if (!rt) {
    throw new Error("FHIR resource type is required");
  }
  return `${b}/${encodeURIComponent(rt)}`;
}

/** Absolute URL for an instance read / vread / history base path. */
export function greenwayFhirInstanceUrl(
  baseUrl: string,
  resourceType: string,
  logicalId: string,
): string {
  const b = baseUrl.replace(/\/$/, "");
  const rt = resourceType.trim();
  const id = logicalId.trim();
  if (!rt || !id) {
    throw new Error("FHIR resource type and logical id are required");
  }
  return `${b}/${encodeURIComponent(rt)}/${encodeURIComponent(id)}`;
}

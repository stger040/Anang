import type { GreenwayFhirEnvConfig } from "./env";
import { greenwayFhirInstanceUrl, greenwayFhirTypeUrl } from "./urls";

export type GreenwayFhirJsonResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

/**
 * GET a FHIR resource JSON by type and logical id. Requires config.accessToken.
 * For server-side use only; do not pass tokens to the browser.
 */
export async function greenwayFhirGetResource(
  config: GreenwayFhirEnvConfig,
  resourceType: string,
  logicalId: string,
  init?: RequestInit,
): Promise<GreenwayFhirJsonResponse> {
  if (!config.accessToken) {
    throw new Error(
      "Greenway FHIR access token is not configured (GREENWAY_FHIR_ACCESS_TOKEN)",
    );
  }
  const url = greenwayFhirInstanceUrl(
    config.baseUrl,
    resourceType,
    logicalId,
  );
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: {
      accept: "application/fhir+json, application/json",
      authorization: `Bearer ${config.accessToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

/**
 * GET a type-level FHIR URL (e.g. search). Requires config.accessToken.
 */
export async function greenwayFhirGetUrl(
  config: GreenwayFhirEnvConfig,
  pathAfterBase: string,
  init?: RequestInit,
): Promise<GreenwayFhirJsonResponse> {
  if (!config.accessToken) {
    throw new Error(
      "Greenway FHIR access token is not configured (GREENWAY_FHIR_ACCESS_TOKEN)",
    );
  }
  const suffix = pathAfterBase.replace(/^\//, "");
  const url = `${config.baseUrl.replace(/\/$/, "")}/${suffix}`;
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: {
      accept: "application/fhir+json, application/json",
      authorization: `Bearer ${config.accessToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

const FHIR_JSON_HEADERS = {
  accept: "application/fhir+json, application/json",
} as const;

/**
 * GET a FHIR URL from a Bundle `link.url` value: absolute https URL or path
 * relative to **config.baseUrl**.
 */
export async function greenwayFhirGetFhirHref(
  config: GreenwayFhirEnvConfig,
  href: string,
  init?: RequestInit,
): Promise<GreenwayFhirJsonResponse> {
  if (!config.accessToken) {
    throw new Error(
      "Greenway FHIR access token is not configured (GREENWAY_FHIR_ACCESS_TOKEN)",
    );
  }
  const h = href.trim();
  if (!h) {
    throw new Error("greenwayFhirGetFhirHref: empty href");
  }
  const base = config.baseUrl.replace(/\/$/, "");
  let url: string;
  if (/^https?:\/\//i.test(h)) {
    url = h;
  } else if (h.startsWith("/")) {
    url = `${base}${h}`;
  } else {
    url = `${base}/${h.replace(/^\//, "")}`;
  }
  const res = await fetch(url, {
    ...init,
    method: "GET",
    headers: {
      ...FHIR_JSON_HEADERS,
      authorization: `Bearer ${config.accessToken}`,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

/** Build a search URL under base (caller adds query string). */
export function greenwayFhirSearchUrl(
  baseUrl: string,
  resourceType: string,
): string {
  return greenwayFhirTypeUrl(baseUrl, resourceType);
}

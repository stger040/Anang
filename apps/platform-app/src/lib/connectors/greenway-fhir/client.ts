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

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function isUrlUnderBase(candidate: URL, base: URL): boolean {
  const basePath = withoutTrailingSlash(base.pathname);
  return (
    candidate.origin === base.origin &&
    (candidate.pathname === basePath ||
      candidate.pathname.startsWith(`${basePath}/`))
  );
}

export function greenwayFhirResolveFhirHref(
  baseUrl: string,
  href: string,
): string {
  const h = href.trim();
  if (!h) {
    throw new Error("greenwayFhirGetFhirHref: empty href");
  }

  const base = new URL(withoutTrailingSlash(baseUrl));
  const basePath = withoutTrailingSlash(base.pathname);

  const candidates = /^https?:\/\//i.test(h)
    ? [new URL(h)]
    : h.startsWith("/")
      ? [new URL(h, base.origin), new URL(`${basePath}${h}`, base.origin)]
      : [new URL(`${basePath}/${h.replace(/^\//, "")}`, base.origin)];

  for (const candidate of candidates) {
    if (isUrlUnderBase(candidate, base)) {
      return candidate.toString();
    }
  }

  throw new Error("greenwayFhirGetFhirHref: href is outside configured FHIR base URL");
}

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
  const url = greenwayFhirResolveFhirHref(config.baseUrl, href);
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

/**
 * Optional OAuth2 client_credentials for Greenway Identity — tenant-specific token URLs
 * and scopes per app registration. See docs/PILOT_CONNECTOR_ROADMAP.md.
 */

export type GreenwayTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

function pickEnv(primary: string | undefined, fallback: string | undefined) {
  const a = primary?.trim();
  if (a) return a;
  const b = fallback?.trim();
  return b || undefined;
}

/**
 * @param suffix - from `greenwayEnvKeySuffixForTenantSlug` (e.g. `LCO`), or `""` for global only.
 */
export function readGreenwayOAuthClientCredentialsForSuffix(
  suffix: string,
): {
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  scope: string | undefined;
} | null {
  const suf = suffix ? `__${suffix}` : "";
  const clientId = pickEnv(
    process.env[`GREENWAY_FHIR_CLIENT_ID${suf}`],
    process.env.GREENWAY_FHIR_CLIENT_ID,
  );
  const clientSecret = pickEnv(
    process.env[`GREENWAY_FHIR_CLIENT_SECRET${suf}`],
    process.env.GREENWAY_FHIR_CLIENT_SECRET,
  );
  const tokenUrl = pickEnv(
    process.env[`GREENWAY_FHIR_TOKEN_URL${suf}`],
    process.env.GREENWAY_FHIR_TOKEN_URL,
  );
  if (!clientId || !clientSecret || !tokenUrl) {
    return null;
  }
  const scope = pickEnv(
    process.env[`GREENWAY_FHIR_OAUTH_SCOPE${suf}`],
    process.env.GREENWAY_FHIR_OAUTH_SCOPE,
  );
  return { clientId, clientSecret, tokenUrl, scope };
}

export function isGreenwayFhirClientCredentialsConfiguredForSuffix(
  suffix: string,
): boolean {
  return readGreenwayOAuthClientCredentialsForSuffix(suffix) !== null;
}

export function isGreenwayFhirClientCredentialsConfigured(): boolean {
  return isGreenwayFhirClientCredentialsConfiguredForSuffix("");
}

/** Returns an access token or null (network / HTTP / JSON shape failures are silent). */
export async function fetchGreenwayAccessTokenForSuffix(
  suffix: string,
): Promise<string | null> {
  const creds = readGreenwayOAuthClientCredentialsForSuffix(suffix);
  if (!creds) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });
  if (creds.scope) {
    body.set("scope", creds.scope);
  }

  let res: Response;
  try {
    res = await fetch(creds.tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body,
    });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const token =
    typeof json === "object" &&
    json !== null &&
    "access_token" in json &&
    typeof (json as GreenwayTokenResponse).access_token === "string"
      ? (json as GreenwayTokenResponse).access_token
      : null;

  return token?.trim() || null;
}

/** Global OAuth credentials only. */
export async function fetchGreenwayAccessTokenWithClientCredentials(): Promise<string | null> {
  return fetchGreenwayAccessTokenForSuffix("");
}

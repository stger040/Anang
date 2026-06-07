/**
 * Optional OAuth2 client_credentials for Greenway Identity — tenant-specific token URLs
 * and scopes per app registration. See docs/PILOT_CONNECTOR_ROADMAP.md.
 */

import {
  createPrivateKey,
  randomUUID,
  sign as signJwtInput,
} from "crypto";

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
  clientSecret: string | undefined;
  privateKeyPem: string | undefined;
  keyId: string | undefined;
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
  const privateKeyPem = normalizePemEnv(
    pickEnv(
      process.env[`GREENWAY_FHIR_CLIENT_PRIVATE_KEY${suf}`],
      process.env.GREENWAY_FHIR_CLIENT_PRIVATE_KEY,
    ),
  );
  const keyId = pickEnv(
    process.env[`GREENWAY_FHIR_CLIENT_KEY_ID${suf}`],
    process.env.GREENWAY_FHIR_CLIENT_KEY_ID,
  );
  const tokenUrl = pickEnv(
    process.env[`GREENWAY_FHIR_TOKEN_URL${suf}`],
    process.env.GREENWAY_FHIR_TOKEN_URL,
  );
  if (!clientId || !tokenUrl || (!clientSecret && !privateKeyPem)) {
    return null;
  }
  const scope = pickEnv(
    process.env[`GREENWAY_FHIR_OAUTH_SCOPE${suf}`],
    process.env.GREENWAY_FHIR_OAUTH_SCOPE,
  );
  return { clientId, clientSecret, privateKeyPem, keyId, tokenUrl, scope };
}

export function isGreenwayFhirClientCredentialsConfiguredForSuffix(
  suffix: string,
): boolean {
  return readGreenwayOAuthClientCredentialsForSuffix(suffix) !== null;
}

export function isGreenwayFhirClientCredentialsConfigured(): boolean {
  return isGreenwayFhirClientCredentialsConfiguredForSuffix("");
}

function normalizePemEnv(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  return v.replace(/\\n/g, "\n");
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function buildGreenwayClientAssertion(creds: {
  clientId: string;
  tokenUrl: string;
  privateKeyPem: string;
  keyId: string | undefined;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({
    alg: "ES384",
    typ: "JWT",
    ...(creds.keyId ? { kid: creds.keyId } : {}),
  });
  const payload = base64urlJson({
    iss: creds.clientId,
    sub: creds.clientId,
    aud: creds.tokenUrl,
    iat: now,
    exp: now + 300,
    jti: randomUUID(),
  });
  const input = `${header}.${payload}`;
  const key = createPrivateKey(creds.privateKeyPem);
  const signature = signJwtInput("sha384", Buffer.from(input, "utf8"), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${input}.${signature.toString("base64url")}`;
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
  });
  if (creds.privateKeyPem) {
    let assertion: string;
    try {
      assertion = buildGreenwayClientAssertion({
        clientId: creds.clientId,
        tokenUrl: creds.tokenUrl,
        privateKeyPem: creds.privateKeyPem,
        keyId: creds.keyId,
      });
    } catch {
      return null;
    }
    body.set(
      "client_assertion_type",
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    body.set("client_assertion", assertion);
  } else if (creds.clientSecret) {
    body.set("client_secret", creds.clientSecret);
  }
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

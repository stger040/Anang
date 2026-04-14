/**
 * Validates public JWKS JSON for Greenway backend-service registration (ES384 / P-384).
 * Only public material is accepted; private key fields are rejected.
 */

export type GreenwayJwksValidationResult =
  | { ok: true; normalizedJson: string }
  | { ok: false; error: string };

const FORBIDDEN_JWK_PROPS = new Set([
  "d",
  "p",
  "q",
  "dp",
  "dq",
  "qi",
  "oth",
  "k",
]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

/**
 * Parse and validate `GREENWAY_JWKS_JSON`. Returns minified canonical JSON for the response body.
 */
export function validateGreenwayPublicJwksJson(raw: string): GreenwayJwksValidationResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "JWKS payload is empty" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "JWKS is not valid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "JWKS root must be a JSON object" };
  }
  const root = parsed as Record<string, unknown>;
  const keys = root.keys;
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, error: 'JWKS must contain a non-empty "keys" array' };
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!key || typeof key !== "object" || Array.isArray(key)) {
      return { ok: false, error: `keys[${i}] must be a JWK object` };
    }
    const jwk = key as Record<string, unknown>;
    for (const p of FORBIDDEN_JWK_PROPS) {
      if (p in jwk) {
        return { ok: false, error: `keys[${i}] must not contain private field "${p}"` };
      }
    }
    if (jwk.kty !== "EC") {
      return { ok: false, error: `keys[${i}].kty must be "EC"` };
    }
    if (jwk.crv !== "P-384") {
      return { ok: false, error: `keys[${i}].crv must be "P-384" for ES384` };
    }
    if (!isNonEmptyString(jwk.x) || !isNonEmptyString(jwk.y)) {
      return { ok: false, error: `keys[${i}] must include non-empty "x" and "y"` };
    }
    if ("use" in jwk && jwk.use !== undefined && jwk.use !== "sig") {
      return { ok: false, error: `keys[${i}].use must be "sig" when set` };
    }
    if ("alg" in jwk && jwk.alg !== undefined && jwk.alg !== "ES384") {
      return { ok: false, error: `keys[${i}].alg must be "ES384" when set` };
    }
  }
  return { ok: true, normalizedJson: JSON.stringify(parsed) };
}

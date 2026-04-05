import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_VERSION = 1;
const DEFAULT_TTL_SEC = 7 * 24 * 60 * 60; // 7 days

export type PatientPayTokenPayload = {
  orgSlug: string;
  statementId: string;
};

function getSecret(): string {
  const s =
    process.env.PATIENT_PAY_LINK_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    "";
  if (!s) {
    throw new Error(
      "PATIENT_PAY_LINK_SECRET or AUTH_SECRET must be set to mint patient pay links.",
    );
  }
  return s;
}

/**
 * URL-safe signed token: base64url(payload).base64url(hmac_sha256(secret, payload)).
 * Payload JSON: `{ v, o: orgSlug, s: statementId, exp: unixSec }`.
 */
export function createPatientPayToken(
  args: PatientPayTokenPayload & { ttlSec?: number },
): string {
  const ttlSec = args.ttlSec ?? DEFAULT_TTL_SEC;
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const inner = JSON.stringify({
    v: TOKEN_VERSION,
    o: args.orgSlug,
    s: args.statementId,
    exp,
  });
  const payloadPart = Buffer.from(inner, "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret())
    .update(payloadPart)
    .digest("base64url");
  return `${payloadPart}.${sig}`;
}

export type PatientPayTokenFailureReason =
  | "unconfigured"
  | "malformed"
  | "invalid"
  | "expired"
  | "wrong_org";

export type PatientPayTokenVerifyResult =
  | { ok: true; payload: PatientPayTokenPayload }
  | { ok: false; reason: PatientPayTokenFailureReason };

/**
 * Same verification as {@link verifyPatientPayToken}, but distinguishes
 * expiry, bad signature, and optional URL org mismatch (`expectedOrgSlug`).
 */
export function verifyPatientPayTokenDetailed(
  token: string,
  expectedOrgSlug?: string,
): PatientPayTokenVerifyResult {
  let secret: string;
  try {
    secret = getSecret();
  } catch {
    return { ok: false, reason: "unconfigured" };
  }
  try {
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return { ok: false, reason: "malformed" };
    const payloadPart = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (!payloadPart || !sig) return { ok: false, reason: "malformed" };
    const expected = createHmac("sha256", secret)
      .update(payloadPart)
      .digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid" };
    }

    const raw = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as { v?: number; o?: string; s?: string; exp?: number };
    if (raw.v !== TOKEN_VERSION || !raw.o || !raw.s || !raw.exp) {
      return { ok: false, reason: "malformed" };
    }
    if (Math.floor(Date.now() / 1000) > raw.exp) {
      return { ok: false, reason: "expired" };
    }
    if (expectedOrgSlug != null && raw.o !== expectedOrgSlug) {
      return { ok: false, reason: "wrong_org" };
    }
    return { ok: true, payload: { orgSlug: raw.o, statementId: raw.s } };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

export function verifyPatientPayToken(
  token: string,
): PatientPayTokenPayload | null {
  const r = verifyPatientPayTokenDetailed(token);
  return r.ok ? r.payload : null;
}

export function patientPayStatementUrl(args: {
  origin: string;
  orgSlug: string;
  token: string;
}): string {
  const base = args.origin.replace(/\/$/, "");
  return `${base}/p/${encodeURIComponent(args.orgSlug)}/pay/${encodeURIComponent(args.token)}`;
}

export { DEFAULT_TTL_SEC as PATIENT_PAY_DEFAULT_TTL_SEC };

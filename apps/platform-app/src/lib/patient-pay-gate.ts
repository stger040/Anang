import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** Cookie name for step-up verification (httpOnly, path=/). */
export const PATIENT_PAY_GATE_COOKIE = "anang_patient_pay_gate";

/** Seconds verification remains valid after successful step-up. */
export const PATIENT_PAY_GATE_MAX_AGE_SEC = 60 * 60;

export function isPatientPayStepUpDisabled(): boolean {
  const v = process.env.DISABLE_PATIENT_PAY_STEPUP?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function gateSecret(): string {
  return (
    process.env.PATIENT_PAY_LINK_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    ""
  );
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 16);
}

/** Signed cookie value bound to a specific magic-link token. */
export function signPatientPayGateCookie(token: string): string | null {
  const secret = gateSecret();
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + PATIENT_PAY_GATE_MAX_AGE_SEC;
  const inner = JSON.stringify({
    v: 1,
    h: tokenFingerprint(token),
    exp,
  });
  const payloadPart = Buffer.from(inner, "utf8").toString("base64url");
  const sig = createHmac("sha256", secret)
    .update(payloadPart)
    .digest("base64url");
  return `${payloadPart}.${sig}`;
}

export function verifyPatientPayGateCookie(
  cookieValue: string | undefined,
  token: string,
): boolean {
  if (isPatientPayStepUpDisabled()) return true;
  const secret = gateSecret();
  if (!secret || !cookieValue) return false;
  try {
    const dot = cookieValue.lastIndexOf(".");
    if (dot <= 0) return false;
    const payloadPart = cookieValue.slice(0, dot);
    const sig = cookieValue.slice(dot + 1);
    if (!payloadPart || !sig) return false;
    const expected = createHmac("sha256", secret)
      .update(payloadPart)
      .digest("base64url");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

    const raw = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as { v?: number; h?: string; exp?: number };
    if (raw.v !== 1 || !raw.h || !raw.exp) return false;
    if (Math.floor(Date.now() / 1000) > raw.exp) return false;
    if (raw.h !== tokenFingerprint(token)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getCookieFromRequest(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  if (!raw) return undefined;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k !== name) continue;
    return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
}

/** Verify identity factors against the patient on a statement. */
export function patientMatchesVerificationFactors(args: {
  dob: Date | null;
  mrn: string | null;
  dobInput: string | undefined;
  accountLast4Input: string | undefined;
}): boolean {
  const dobOk = checkDob(args.dob, args.dobInput);
  const last4Ok = checkAccountLast4(args.mrn, args.accountLast4Input);

  if (args.dob) {
    return dobOk || last4Ok;
  }
  return last4Ok;
}

function checkDob(dob: Date | null, input: string | undefined): boolean {
  if (!dob || !input?.trim()) return false;
  const t = input.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return false;
  return (
    dob.getUTCFullYear() === y &&
    dob.getUTCMonth() + 1 === mo &&
    dob.getUTCDate() === d
  );
}

function checkAccountLast4(mrn: string | null, input: string | undefined): boolean {
  if (!input?.trim()) return false;
  const expected = mrnLastFourReference(mrn);
  if (!expected) return false;
  const got = normalizeLast4Input(input);
  if (!got) return false;
  return timingSafeEqual(Buffer.from(got, "utf8"), Buffer.from(expected, "utf8"));
}

function normalizeLast4Input(input: string): string | null {
  const t = input.trim().toLowerCase().replace(/\s+/g, "");
  if (t.length < 4) return null;
  const last4 = t.slice(-4);
  return /^[a-z0-9]{4}$/.test(last4) ? last4 : null;
}

/** Reference last four characters for MRN / account number display on file. */
export function mrnLastFourReference(mrn: string | null): string | null {
  if (!mrn?.trim()) return null;
  const digits = mrn.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(-4).toLowerCase();
  const alnum = mrn.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 4) return alnum.slice(-4).toLowerCase();
  return null;
}

export function patientPayVerificationHint(args: {
  dob: Date | null;
  mrn: string | null;
}): "dob_or_account" | "account_only" | "unavailable" {
  const last4 = mrnLastFourReference(args.mrn);
  if (args.dob) return "dob_or_account";
  if (last4) return "account_only";
  return "unavailable";
}

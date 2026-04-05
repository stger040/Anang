/**
 * NCPDP / pharmacy claim format hints (E2b2b6 scaffold).
 * Not a standards-conformant parser — use for routing and future Teleclaim/SCRIPT work.
 * @see docs/CONNECTOR_STRATEGY.md Appendix B
 */

export type NcpdpFormatHint =
  | "unknown"
  /** Variable ASCII with segment-style * delimiters and NCPDP-style AM qualifiers */
  | "teleclaim_line_ascii_hint"
  /** Very weak: long numeric-heavy batch (may be non-NCPDP — confirm with partner) */
  | "script_batch_numeric_hint";

/**
 * Best-effort classification of a raw payload. False negatives are expected.
 */
export function detectNcpdpClaimAsciiHint(raw: string): NcpdpFormatHint {
  const s = raw.trim();
  if (s.length < 8) {
    return "unknown";
  }
  // Common telecommunication transaction IDs (e.g. AM01 Claim) appear in many ASCII encodings.
  if (
    /\*AM(01|04|07|21)\*/i.test(s) ||
    /(^|~)AM(01|04|07|21)\*/i.test(s) ||
    (/^[A-Z0-9]{2}\*/.test(s) && s.includes("*D2*"))
  ) {
    return "teleclaim_line_ascii_hint";
  }
  if (/^\d{12,}/.test(s) && s.length >= 120 && /^\d+$/.test(s.replace(/\s/g, ""))) {
    return "script_batch_numeric_hint";
  }
  return "unknown";
}

export function isNcpdpConnectorScaffoldEnabled(): boolean {
  const v = process.env.NCPDP_CONNECTOR_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

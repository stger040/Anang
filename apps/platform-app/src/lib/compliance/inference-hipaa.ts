/**
 * HIPAA-oriented inference guardrails (org policy via env — not legal advice).
 *
 * When `INFERENCE_HIPAA_STRICT=1`:
 * - Bill-line explain uses minimal payload (code + amount only) even if `OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD` is unset.
 * - Support assistant redacts obvious identifier patterns before any LLM call.
 * - Prefer `BILL_EXPLAIN_LLM_PROVIDER=azure` + Azure OpenAI under your Microsoft BAA for PHI.
 */

export function isInferenceHipaaStrict(): boolean {
  const v = process.env.INFERENCE_HIPAA_STRICT?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Effective minimal payload for bill-line explain (strict forces minimal). */
export function effectiveBillExplainMinimalPayload(): boolean {
  if (isInferenceHipaaStrict()) return true;
  const v =
    process.env.OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** When strict + only consumer api.openai.com, log once per process (caller may throttle). */
export function shouldLogOpenAiComplianceReminder(): boolean {
  return (
    isInferenceHipaaStrict() &&
    process.env.BILL_EXPLAIN_LLM_PROVIDER?.trim().toLowerCase() !== "azure"
  );
}

const EMAIL_RE = /\b[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g;
const PHONE_LIKE_RE = /(?:\+1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const SSN_LIKE_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
const MRN_LIKE_RE = /\b(?:MRN|medical\s*record|account\s*#)\s*[:#]?\s*[\w-]+\b/gi;

/**
 * Best-effort redaction before LLM calls when strict HIPAA routing is enabled.
 * Not a complete de-identifier — prefer avoiding raw PHI in Support chat entirely.
 */
export function redactLikelyIdentifiersForLlm(text: string): string {
  return text
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_LIKE_RE, "[redacted-phone]")
    .replace(SSN_LIKE_RE, "[redacted-ssn]")
    .replace(MRN_LIKE_RE, "[redacted-id]");
}

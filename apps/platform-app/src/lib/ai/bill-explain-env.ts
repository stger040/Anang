/** Kill switch: template-only (recommended for prod without BAA‑covered inference). */
export function isOpenAiBillExplainDisabled(): boolean {
  const v = process.env.OPENAI_DISABLE_BILL_EXPLAIN?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Send only billing code + amount to OpenAI; omit free‑text description. */
export function isOpenAiBillExplainMinimalPayload(): boolean {
  const v =
    process.env.OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

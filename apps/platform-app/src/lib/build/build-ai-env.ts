/**
 * Testing-phase Build AI gates (see docs/BUILD_AI_TESTING.md).
 */

export function isBuildAiTestingEnabled(): boolean {
  const v = process.env.BUILD_AI_TESTING_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Model for Build AI JSON suggestion calls (falls back to OPENAI_CHAT_MODEL / gpt-4o-mini). */
export function buildAiOpenAiModel(): string {
  return (
    process.env.BUILD_OPENAI_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "gpt-4o-mini"
  );
}

/** Prompt version string stored on BuildSuggestionRun for audits. */
export const BUILD_AI_PROMPT_VERSION = "build_ai_suggest_codes_v1";

/**
 * When no FeeScheduleRate matches CPT (+ POS), use this charge for testing so rules still run.
 * Set BUILD_AI_MISSING_RATE_FALLBACK_CENTS=0 to surface zero-charge rule issues instead.
 */
export function buildAiMissingRateFallbackCents(): number {
  const raw = process.env.BUILD_AI_MISSING_RATE_FALLBACK_CENTS?.trim();
  if (raw === "" || raw === undefined) return 25_000;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 25_000;
}

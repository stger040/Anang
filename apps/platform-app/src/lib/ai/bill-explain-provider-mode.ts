/**
 * Which hosted chat endpoint backs bill-line explanations.
 *
 * - `openai` — api.openai.com (consumer/enterprise OpenAI API key).
 * - `azure` — Azure OpenAI deployment (private endpoint + api-key header).
 * - `auto` — Azure if endpoint, api key, and deployment are all set; otherwise OpenAI.
 */
export type BillExplainLlmProviderName = "openai" | "azure";

export function parseBillExplainLlmProviderRaw(): string {
  return process.env.BILL_EXPLAIN_LLM_PROVIDER?.trim().toLowerCase() ?? "";
}

export function isAzureOpenAiBillExplainConfigured(): boolean {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const key = process.env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  return Boolean(endpoint && key && deployment);
}

/** Resolved provider for `getDefaultBillLineExplainer` (not including template-only kill switch). */
export function resolveBillExplainLlmProvider(): BillExplainLlmProviderName {
  const raw = parseBillExplainLlmProviderRaw();
  if (raw === "azure") return "azure";
  if (raw === "openai") return "openai";
  if (isAzureOpenAiBillExplainConfigured()) return "azure";
  return "openai";
}

import type { BillLineExplanationProvider } from "@/lib/ai/explanation-types";
import { resolveBillExplainLlmProvider } from "@/lib/ai/bill-explain-provider-mode";
import { AzureOpenAiBillLineExplanationProvider } from "@/lib/ai/providers/azure-openai-bill-line";
import { OpenAiBillLineExplanationProvider } from "@/lib/ai/providers/openai-bill-line";

let cached: BillLineExplanationProvider | undefined;

export function getDefaultBillLineExplainer(): BillLineExplanationProvider {
  if (!cached) {
    cached =
      resolveBillExplainLlmProvider() === "azure"
        ? new AzureOpenAiBillLineExplanationProvider()
        : new OpenAiBillLineExplanationProvider();
  }
  return cached;
}

/** Test hook — reset singleton when swapping providers in unit tests. */
export function resetDefaultBillLineExplainerForTests(): void {
  cached = undefined;
}

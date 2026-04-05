import { isOpenAiBillExplainDisabled } from "@/lib/ai/bill-explain-env";
import {
  billLineChatMessages,
  parseChatCompletionText,
  type ChatCompletionsJson,
} from "@/lib/ai/providers/openai-chat-shared";
import { platformLog } from "@/lib/platform-log";
import type {
  BillLineExplanationProvider,
  ExplainLineInput,
  ExplainLineResult,
} from "@/lib/ai/explanation-types";
import { templateExplainStatementLine } from "@/lib/ai/providers/template-bill-line";

function azureChatCompletionsUrl(): string | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim().replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT?.trim();
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION?.trim() || "2024-08-01-preview";
  if (!endpoint || !deployment) return null;
  const q = new URLSearchParams({ "api-version": apiVersion });
  return `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?${q}`;
}

async function explainWithAzureOpenAI(
  input: ExplainLineInput,
): Promise<string | null> {
  if (isOpenAiBillExplainDisabled()) return null;

  const url = azureChatCompletionsUrl();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!url || !apiKey) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: billLineChatMessages(input),
        max_tokens: 450,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      platformLog("warn", "pay.bill_explain.azure_http_error", {
        status: res.status,
        detail: errBody.slice(0, 500),
      });
      return null;
    }
    const j = (await res.json()) as ChatCompletionsJson;
    return parseChatCompletionText(j);
  } catch (e) {
    platformLog("warn", "pay.bill_explain.azure_request_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

/** Azure OpenAI Chat Completions; falls back to template when disabled, misconfigured, or on error. */
export class AzureOpenAiBillLineExplanationProvider
  implements BillLineExplanationProvider
{
  async explain(input: ExplainLineInput): Promise<ExplainLineResult> {
    const fromLlm = await explainWithAzureOpenAI(input);
    if (fromLlm) {
      return { text: fromLlm, source: "azure_openai" };
    }
    return {
      text: templateExplainStatementLine(input),
      source: "template",
    };
  }
}

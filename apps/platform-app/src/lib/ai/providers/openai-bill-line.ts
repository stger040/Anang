import { isOpenAiBillExplainDisabled } from "@/lib/ai/bill-explain-env";
import { shouldLogOpenAiComplianceReminder } from "@/lib/compliance/inference-hipaa";
import { platformLog } from "@/lib/platform-log";
import {
  billLineChatMessages,
  parseChatCompletionText,
  type ChatCompletionsJson,
} from "@/lib/ai/providers/openai-chat-shared";
import type {
  BillLineExplanationProvider,
  ExplainLineInput,
  ExplainLineResult,
} from "@/lib/ai/explanation-types";
import { templateExplainStatementLine } from "@/lib/ai/providers/template-bill-line";

let hipaaOpenAiReminderSent = false;

async function explainWithOpenAI(input: ExplainLineInput): Promise<string | null> {
  if (isOpenAiBillExplainDisabled()) return null;

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  if (shouldLogOpenAiComplianceReminder() && !hipaaOpenAiReminderSent) {
    hipaaOpenAiReminderSent = true;
    platformLog("warn", "pay.bill_explain.hipaa_openai_compliance_reminder", {
      message:
        "INFERENCE_HIPAA_STRICT is on but BILL_EXPLAIN_LLM_PROVIDER is not azure — confirm BAA and data retention with your vendor before real PHI.",
    });
  }

  const modelFixed =
    process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelFixed,
        max_tokens: 450,
        temperature: 0.4,
        messages: billLineChatMessages(input),
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      platformLog("warn", "pay.bill_explain.openai_http_error", {
        status: res.status,
        detail: errBody.slice(0, 500),
      });
      return null;
    }
    const j = (await res.json()) as ChatCompletionsJson;
    return parseChatCompletionText(j);
  } catch (e) {
    platformLog("warn", "pay.bill_explain.openai_request_failed", {
      message: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

/** OpenAI Chat Completions adapter; falls back to template when disabled or on error. */
export class OpenAiBillLineExplanationProvider
  implements BillLineExplanationProvider
{
  async explain(input: ExplainLineInput): Promise<ExplainLineResult> {
    const fromLlm = await explainWithOpenAI(input);
    if (fromLlm) {
      return { text: fromLlm, source: "openai" };
    }
    return {
      text: templateExplainStatementLine(input),
      source: "template",
    };
  }
}

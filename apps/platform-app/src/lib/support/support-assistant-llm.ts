import {
  isInferenceHipaaStrict,
  redactLikelyIdentifiersForLlm,
} from "@/lib/compliance/inference-hipaa";
import { platformLog } from "@/lib/platform-log";
import {
  runSupportAssistantTurn,
  type SupportAssistantMessage,
  type SupportAssistantTurnInput,
  type SupportAssistantTurnResult,
} from "@/lib/support/support-assistant";

function supportAssistantLlmEnabled(): boolean {
  const v = process.env.SUPPORT_ASSISTANT_LLM_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

type ChatJson = {
  choices?: Array<{ message?: { content?: string } }>;
};

function scrubForLlm(messages: SupportAssistantMessage[]): SupportAssistantMessage[] {
  const strict = isInferenceHipaaStrict();
  if (!strict) return messages;
  return messages.map((m) => ({
    ...m,
    content: redactLikelyIdentifiersForLlm(m.content),
  }));
}

/**
 * Optional OpenAI completion for Support hub — same API key stack as bill-line when enabled.
 * Returns `null` to fall back to template {@link runSupportAssistantTurn}.
 */
export async function maybeRunSupportAssistantLlmTurn(
  input: SupportAssistantTurnInput,
  ctx: { tenantId: string; orgSlug: string; requestId?: string },
): Promise<SupportAssistantTurnResult | null> {
  if (!supportAssistantLlmEnabled()) return null;

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model =
    process.env.SUPPORT_ASSISTANT_OPENAI_MODEL?.trim() ||
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    "gpt-4o-mini";

  const base = runSupportAssistantTurn(input);
  if (base.escalationRecommended) {
    return base;
  }

  const messages = scrubForLlm(input.messages);
  const sys = `You are a billing operations assistant for healthcare RCM staff. Stay generic: no legal or clinical advice, no guarantees about coverage. Prefer short actionable steps. If the user appears angry about legal issues or safety, say they should escalate to a human supervisor.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.35,
        messages: [
          { role: "system", content: sys },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      platformLog("warn", "support.assistant.openai_http_error", {
        tenantId: ctx.tenantId,
        orgSlug: ctx.orgSlug,
        status: res.status,
        detail: detail.slice(0, 400),
        ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
      });
      return null;
    }

    const j = (await res.json()) as ChatJson;
    const text = j?.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    return {
      reply: text,
      suggestedTools: base.suggestedTools,
      escalationRecommended: base.escalationRecommended,
      escalationReason: base.escalationReason,
      toolCatalogVersion: base.toolCatalogVersion,
    };
  } catch (e) {
    platformLog("warn", "support.assistant.openai_request_failed", {
      tenantId: ctx.tenantId,
      orgSlug: ctx.orgSlug,
      message: e instanceof Error ? e.message : "unknown",
      ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    });
    return null;
  }
}

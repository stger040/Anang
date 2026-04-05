import { SUPPORT_ASSISTANT_TOOL_DEFINITIONS } from "@/lib/support/support-assistant-tools";

export type SupportAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SupportAssistantTurnInput = {
  messages: SupportAssistantMessage[];
  /** Non-PHI context for template replies. */
  openTaskCount: number;
  urgentOpenCount: number;
};

export type SupportAssistantTurnResult = {
  reply: string;
  /** Tool names that a future LLM runner could bind (execution not wired here). */
  suggestedTools: string[];
  escalationRecommended: boolean;
  escalationReason?: string;
  toolCatalogVersion: "support_v1";
};

const ESCALATION_TRIGGERS =
  /\b(lawsuit|attorney|lawyer|hipaa\s*complaint|ocr|discrimination|suicid|kill\s*myself|emergency)\b/i;

function lastUserContent(messages: SupportAssistantMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i]!.content;
  }
  return "";
}

/**
 * Template-first Support assistant turn — safe default without shipping PHI to a model.
 * Extend with an LLM + tool executor behind the same result shape when compliant inference exists.
 */
export function runSupportAssistantTurn(
  input: SupportAssistantTurnInput,
): SupportAssistantTurnResult {
  const last = lastUserContent(input.messages).trim();
  const escalateLegal = ESCALATION_TRIGGERS.test(last);
  const lower = last.toLowerCase();
  const wantsTasks =
    /\b(queue|tasks|work|open|backlog|list)\b/i.test(last) ||
    lower.includes("what's open");

  const suggestedTools: string[] = [];
  if (wantsTasks) suggestedTools.push("list_open_support_tasks");
  if (
    /\b(create|new|log|ticket|task)\b/i.test(last) &&
    last.length > 12
  ) {
    suggestedTools.push("create_support_task_draft");
  }
  if (escalateLegal) suggestedTools.push("escalate_to_human");

  let reply =
    "I’m a billing-support assistant (template mode). I can describe how to use this queue, " +
    "suggest next steps for common billing questions, and flag when a human should take over. " +
    "I don’t access live ledgers or guarantee coverage.";

  if (wantsTasks) {
    reply += ` This tenant currently has ${input.openTaskCount} open task(s)`;
    if (input.urgentOpenCount > 0) {
      reply += `, including ${input.urgentOpenCount} marked urgent`;
    }
    reply += ". Use the task list below for details.";
  }

  if (escalateLegal) {
    reply +=
      " This message looks like it may need a specialist or supervisor — please escalate outside this chat.";
  }

  return {
    reply,
    suggestedTools,
    escalationRecommended: escalateLegal,
    escalationReason: escalateLegal
      ? "High-risk or legal/safety keyword heuristic matched."
      : undefined,
    toolCatalogVersion: "support_v1",
  };
}

export function supportAssistantToolDefinitionsJson() {
  return SUPPORT_ASSISTANT_TOOL_DEFINITIONS;
}

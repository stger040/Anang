/**
 * Tool definitions for a future LLM-calling Support copilot.
 * Not used by Build / claim prompts — separate system per MEDICAL_AI_AND_EXPLANATION_LAYER.md.
 *
 * Shape aligns with OpenAI-style function/tool JSON Schema for easy wiring later.
 */

export type SupportAssistantToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
};

export const SUPPORT_ASSISTANT_TOOL_DEFINITIONS: SupportAssistantToolDefinition[] =
  [
    {
      name: "list_open_support_tasks",
      description:
        "Summarize open Support tasks for the current tenant (counts, urgent). Does not expose PHI in the model; staff UI loads details.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Max tasks to summarize (default 10).",
          },
        },
      },
    },
    {
      name: "create_support_task_draft",
      description:
        "Prepare fields for a new Support task from the conversation (staff confirms before create).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          category: {
            type: "string",
            description:
              "billing_question | payment_plan | coverage | other",
          },
          priority: {
            type: "string",
            description: "normal | urgent",
          },
        },
        required: ["title"],
      },
    },
    {
      name: "escalate_to_human",
      description:
        "Recommend handoff to a supervisor or back-office specialist when policy, legal tone, or clinical questions appear.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
          urgency: { type: "string", description: "normal | high" },
        },
        required: ["reason"],
      },
    },
  ];

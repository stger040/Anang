import type { ExplainLineInput } from "@/lib/ai/explanation-types";
import { effectiveBillExplainMinimalPayload } from "@/lib/compliance/inference-hipaa";

export const BILL_LINE_SYSTEM_PROMPT = `You are a billing education assistant for U.S. healthcare patients and staff.
Explain statement line items in clear, neutral English (2–4 short paragraphs or bullet-friendly sentences).

Rules:
- Describe what the charge *category* usually represents in general terms. If a CPT or HCPCS code is present, you may summarize what it commonly covers, with wording like "often" or "typically."
- Do NOT diagnose, treat, or give personal medical advice.
- Do NOT guarantee insurance coverage, deductibles, or that the patient's situation matches any example.
- Do NOT invent facility-specific policies.
End with one sentence that billing offices and EOB documents are authoritative for this account.`;

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function billLineChatMessages(input: ExplainLineInput) {
  const minimal = effectiveBillExplainMinimalPayload();
  const userPayload = minimal
    ? {
        code: input.code,
        amountUsd: formatUsd(input.amountCents),
        note: "Free-text charge description omitted from this request for privacy. Infer only from the billing code and amount.",
      }
    : {
        code: input.code,
        description: input.description,
        amountUsd: formatUsd(input.amountCents),
      };

  return [
    { role: "system" as const, content: BILL_LINE_SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: `Explain this statement line for someone reading their bill:\n${JSON.stringify(userPayload, null, 2)}`,
    },
  ];
}

export type ChatCompletionsJson = {
  choices?: Array<{ message?: { content?: string } }>;
};

export function parseChatCompletionText(raw: ChatCompletionsJson): string | null {
  const text = raw?.choices?.[0]?.message?.content?.trim();
  return text && text.length > 0 ? text : null;
}

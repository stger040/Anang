import { platformLog } from "@/lib/platform-log";

import { buildAiOpenAiModel } from "@/lib/build/build-ai-env";

const SYSTEM = `You are a U.S. professional medical coding assistant for **testing only**.
Return **only** valid JSON (no markdown) with this exact shape:
{"lines":[{"icd10":"string","cpt":"string","modifier":"string or null","units":number,"rationale":"string"}]}

Rules:
- Suggest **ICD-10** and **CPT or HCPCS** codes that plausibly match the encounter narrative.
- **modifiers**: use null if none; otherwise a single common modifier or comma-separated if needed.
- **units**: integer >= 1.
- **rationale**: short clinical/billing justification per line (1 sentence).
- Do **NOT** include dollar amounts, charges, fees, or allowed/paid amounts.
- Do **NOT** diagnose the real patient or give medical advice; this is synthetic test data.
- If unsure, still propose your best single primary line plus secondary lines only when clearly supported by the text.`;

export type BuildAiSuggestedLine = {
  icd10: string;
  cpt: string;
  modifier: string | null;
  units: number;
  rationale: string;
};

export type BuildAiOpenAiResult =
  | { ok: true; lines: BuildAiSuggestedLine[]; rawJson: string }
  | { ok: false; error: string };

/** GPT-5 / o-series reasoning models reject custom `temperature` (HTTP 400). */
function isReasoningStyleChatModel(model: string): boolean {
  const m = model.trim().toLowerCase();
  return (
    m.startsWith("gpt-5") ||
    m.startsWith("o1") ||
    m.startsWith("o3") ||
    m.startsWith("o4") ||
    /^o\d/.test(m)
  );
}

function openAiHttpErrorMessage(status: number, rawText: string): string {
  try {
    const j = JSON.parse(rawText) as { error?: { message?: string } };
    const msg = j?.error?.message;
    if (msg && typeof msg === "string") {
      return `OpenAI HTTP ${status}: ${msg}`;
    }
  } catch {
    /* ignore */
  }
  const clip = rawText.trim().slice(0, 240);
  return clip ? `OpenAI HTTP ${status}: ${clip}` : `OpenAI HTTP ${status}`;
}

function parseLinesPayload(text: string): BuildAiSuggestedLine[] | null {
  let obj: unknown;
  try {
    obj = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object" || !("lines" in obj)) return null;
  const lines = (obj as { lines: unknown }).lines;
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const out: BuildAiSuggestedLine[] = [];
  for (const row of lines) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const icd10 = typeof r.icd10 === "string" ? r.icd10.trim() : "";
    const cpt = typeof r.cpt === "string" ? r.cpt.trim() : "";
    const rationale =
      typeof r.rationale === "string" ? r.rationale.trim() : "";
    let modifier: string | null = null;
    if (r.modifier === null || r.modifier === undefined) modifier = null;
    else if (typeof r.modifier === "string" && r.modifier.trim())
      modifier = r.modifier.trim();
    let units = 1;
    if (typeof r.units === "number" && Number.isFinite(r.units)) {
      units = Math.max(1, Math.floor(r.units));
    }
    if (!icd10 || !cpt || !rationale) continue;
    out.push({ icd10, cpt, modifier, units, rationale });
  }
  return out.length ? out : null;
}

export async function fetchBuildAiCodeSuggestions(args: {
  userPayload: Record<string, unknown>;
}): Promise<BuildAiOpenAiResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "OPENAI_API_KEY is not set." };
  }

  const model = buildAiOpenAiModel();
  const userContent = JSON.stringify(args.userPayload, null, 2);
  const reasoning = isReasoningStyleChatModel(model);

  const body: Record<string, unknown> = {
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Encounter context (testing):\n${userContent}\n\nRemember: respond with JSON only, shape {"lines":[...]} — no charges.`,
      },
    ],
  };

  if (reasoning) {
    body.max_completion_tokens = 1200;
  } else {
    body.temperature = 0.2;
    body.max_tokens = 1200;
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });

    const rawText = await res.text();
    if (!res.ok) {
      platformLog("warn", "build.ai.openai_http", {
        status: res.status,
        detail: rawText.slice(0, 800),
      });
      return { ok: false, error: openAiHttpErrorMessage(res.status, rawText) };
    }

    const j = JSON.parse(rawText) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = j?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { ok: false, error: "Empty model response" };
    }

    const lines = parseLinesPayload(content);
    if (!lines) {
      return { ok: false, error: "Could not parse JSON lines from model" };
    }

    return { ok: true, lines, rawJson: content };
  } catch (e) {
    const message = e instanceof Error ? e.message : "request failed";
    platformLog("warn", "build.ai.openai_failed", { message });
    return { ok: false, error: message };
  }
}

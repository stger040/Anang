/**
 * Plain-language billing education for a single statement line — **IMPLEMENTATION_PLAN**
 * “Medical AI 1.0” slice (patient / staff-facing copy).
 *
 * **HIPAA / PHI:** Charge **descriptions** may contain identifiable or sensitive text.
 * The default **consumer OpenAI API** is generally **not** an acceptable destination for
 * protected health information unless you have a **HIPAA-aligned** arrangement (e.g.
 * **Azure OpenAI** in your cloud with a **BAA**, enterprise agreement with zero retention,
 * or an on‑prem model). Set **`BILL_EXPLAIN_LLM_PROVIDER=azure`** (and `AZURE_OPENAI_*`)
 * to call a deployment instead of `api.openai.com`, or use **`OPENAI_DISABLE_BILL_EXPLAIN=1`**
 * (template only), and/or **`OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD=1`** so only code + amount
 * are sent to the model.
 *
 * Provider implementation lives under **`src/lib/ai/`** — swap adapters without changing routes.
 */

export {
  isOpenAiBillExplainDisabled,
  isOpenAiBillExplainMinimalPayload,
} from "@/lib/ai/bill-explain-env";

export type {
  ExplainLineInput,
  ExplainLineResult,
} from "@/lib/ai/explanation-types";
export { templateExplainStatementLine } from "@/lib/ai/providers/template-bill-line";

import { getDefaultBillLineExplainer } from "@/lib/ai/resolve-bill-line-explainer";
import type { ExplainLineInput, ExplainLineResult } from "@/lib/ai/explanation-types";

export async function explainStatementLine(
  input: ExplainLineInput,
): Promise<ExplainLineResult> {
  return getDefaultBillLineExplainer().explain(input);
}

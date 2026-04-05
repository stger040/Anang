# Medical AI & explanation layer — evolution plan

**Purpose:** Document the current **bill line explanation** slice (“Medical AI 1.0” on Pay), how it should **evolve** into a **model-provider-agnostic explanation layer**, and how that differs from **Build** (staff) and **Support** (guardrailed assistant).

**Product rule:** Anang is **not LLM-first**. **Deterministic rules + retrieval + narrow models** carry **truth** for revenue-cycle logic; **LLMs** primarily **explain**, **summarize**, and power **conversational UI** under **HIPAA-aware** controls.

---

## 1. Current implementation (review)

| Asset | Role |
|-------|------|
| `apps/platform-app/src/lib/bill-line-explain.ts` | Public entry: `explainStatementLine`, env helpers, re-exports. |
| `apps/platform-app/src/lib/ai/*` | **`BillLineExplanationProvider`**, OpenAI adapter, template path — swap providers here. |
| `apps/platform-app/src/app/api/pay/explain-line/route.ts` | `POST /api/pay/explain-line` — server entry, tenant/session context as implemented. |
| `apps/platform-app/src/components/statement-line-explain.tsx` | UI for statement line explanation. |
| `apps/platform-app/src/lib/integration-status.ts` | `medicalAiBillExplain` integration flag. |
| `apps/platform-app/src/lib/support/support-assistant*.ts` | **Support** tool schema + template turn (`POST /api/support/assistant`) — not Build. |
| Tests | `bill-line-explain.test.ts` (and any route tests). |

**Strengths to keep:**

- **Template-only path** when API key missing or `OPENAI_DISABLE_BILL_EXPLAIN` set — **required** for production without BAA-covered inference.
- **`OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD`** — reduces PHI/PHI-adjacent free text sent to a model.
- **Guardrails in system prompt** — no medical advice, no coverage guarantees, EOB/staff authoritative.
- **Explicit `source`** (`openai`, `azure_openai`, `template`) in result type — good for audit UI.

---

## 2. What should be abstracted (next engineering)

Introduce a small **inference abstraction** (package or `src/lib/ai/` module) used by Pay explain (and later Support), roughly:

- **`ExplanationProvider` interface** — `explainBillingLine(input) -> { text, source, providerId?, modelVersion? }`
- **Implementations:** `TemplateExplanationProvider`, `OpenAiChatCompletionProvider` (current behavior), later `AzureOpenAiProvider`, `AnthropicProvider`, **no-op / stub** for CI.
- **Configuration:** env selects provider + flags (disable, minimal payload, max tokens, region).
- **Logging:** log **statement line id + tenant + provider id + template vs remote** — not raw description when policy says no.

**Build** should **not** depend on this Pay-oriented abstraction for **core claim validation**; Build uses a **rule engine + retrieval service** with separate types.

---

## 3. Evolving bill explain

| Direction | Action |
|-----------|--------|
| **Provider swap** | All OpenAI-specific code in one adapter; callers use interface only. |
| **Grounding** | Optionally prepend **retrieval snippets** (CPT glossary, tenant bill explainer SOP) to the prompt — **citations** in UI when available. |
| **Deterministic fallback** | Template path remains default in high-compliance tenants; never remove. |
| **Payload policy** | Centralize “what fields may leave the boundary” in one policy module shared with future Support chat. |

---

## 4. Reuse for Support vs not

| Concern | Support assistant | Build core logic |
|---------|-------------------|------------------|
| **Purpose** | Explain balances, statements, payment options, **escalate** ambiguous cases | Pre-submit validation, coding consistency, payer edits, denials normalization |
| **Reuse** | **Same provider abstraction**, shared **retrieval** for glossaries/SOPs, similar **template fallback** | **Do not** reuse Pay prompt or patient explain as authority |
| **Orchestration** | **Tool-driven**: fetch statement, create task, hand off to human — **not** unconstrained agent | **Rules engine** + scored outputs; LLM at most **paraphrases** rule output |
| **Risk** | Medical advice / coverage promises — **blocked** by policy + tools | Wrong code / lost revenue — **human-in-the-loop** + audit log |

**Support** should be documented and implemented as a **separate** capability (own prompts, tools, escalation), sharing only **infrastructure** (provider interface, telemetry, guardrail library).

---

## 5. Compliance checklist (short)

- Template-only mode for tenants without compliant inference.
- Minimal-payload mode for code-first explanations.
- Path to **BAA-covered** hosting documented in `docs/DEPLOYMENT.md` (Azure OpenAI, private endpoints, etc.).
- No consumer-grade API for **full clinical notes** or **full patient narratives** without legal sign-off.

---

*Document version: 1.0 — companion to implementation in `bill-line-explain.ts`; update when the provider abstraction lands.*

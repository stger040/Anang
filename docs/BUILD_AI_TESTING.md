# Build AI — testing phase (synthetic environment)

This document describes the **testing-only** Build AI path. It is **not** first-client production onboarding. The goal is a **testable, observable, auditable** workflow on the **synthetic-testing Neon** branch and datasets described in `IMPORT_SYNTHETIC_DATASETS.md`.

## What the model does (and does not do)

- **Does:** propose structured coding suggestions — ICD-10, CPT/HCPCS, modifiers, units, and per-line rationale — from encounter narrative context.
- **Does not:** output billed amounts, allowed amounts, paid amounts, or any dollar charges. Charges are **never** invented by the LLM.

## Where charges come from

Imported synthetic claims and claim lines in the database carry historical **billed / allowed / paid** values for realism and regression testing. Those fields are **reference data**, not the runtime pricing engine for Build AI.

For Build AI testing, billed charges on **new** draft lines come only from:

1. **`FeeSchedule`** / **`FeeScheduleRate`** rows scoped to the tenant, schedule name `SYNTHETIC_BUILD_TESTING_V1`, marked synthetic.
2. Lookups use normalized CPT (and optional **place of service** on the encounter when a rate exists for that key; otherwise wildcard POS `""`).
3. If no rate matches, **`BUILD_AI_MISSING_RATE_FALLBACK_CENTS`** supplies a test charge so deterministic rules still run.

Populating the fee table is a **batch step**: run `npm run db:derive:synthetic-fees` (or `:neon`) after import. That script aggregates **max `chargeCents`** from **`ClaimDraftLine` rows with `lineSource = IMPORTED`** (grouped by CPT and optional encounter POS). It does **not** call the model and does not read paid/allowed columns at runtime for AI.

## Audit trail

- **`BuildSuggestionRun`**: one record per invocation (tenant, encounter, draft, model id string, `promptVersion`, status, optional `rawResponseJson`, actor).
- **`BuildSuggestionLine`**: per suggested line — codes, rationale, **`chargeCentsApplied`**, optional link to **`FeeScheduleRate`** and **`ClaimDraftLine`**, `reviewStatus` (v1 mostly `pending`; human accept/reject granularity is reserved).

Draft activity also logs **`ai_suggestion_applied`** and **`draft_lines_cleared_test`** via **`BuildDraftEvent`**.

## Encounter fields used as context

The model receives **only** the JSON object built in `suggest-draft-from-encounter.ts` (`encounterPayload`). There is no broad chart RAG or live payer policy retrieval in this phase.

**Included when present:**

| Field | Role |
|--------|------|
| `dateOfService` | DOS (ISO date) |
| `chiefComplaint` | Short reason for visit |
| `visitSummary` | Main clinical note / narrative (often the richest signal) |
| `assessment` | Assessment text if stored on the encounter |
| `placeOfService` | POS code/text (also used **after** the call to pick fee-table rows) |
| `visitType` | Visit type label |
| `providerSpecialty` | Specialty hint |
| `patient.firstName`, `patient.lastName`, `patient.mrn`, `patient.ageHint` | Identity context only (no full chart) |

**Not sent to the model:** prior claim dollars, fee schedules, payer contracts, or full problem lists beyond what is in those strings.

**Draft line display:** Each line shows **ICD-10 / CPT short titles** from the model (`icd10Descriptor`, `cptDescriptor`) when returned, then a **small static map** for common testing codes, plus **external lookup links**. Staff must still verify against your **code book and payer policy**.

Narrative quality in synthetic seed data affects suggestion quality; this is expected in testing.

## Build module workflow (staff order)

See **[BUILD_MODULE_WORKFLOW.md](./BUILD_MODULE_WORKFLOW.md)** for the recommended click order (queue → encounter → optional AI → validate → approve).

## UI: telling import apart from AI

- **`ClaimDraftLine.lineSource`**: `IMPORTED` (workbook/seed) vs `AI_SUGGESTION` (after a successful suggestion run).
- The encounter page shows **badges** per line and a **testing** callout when **`BUILD_AI_TESTING_ENABLED`** is set.
- **Clear draft lines (testing)** removes lines and rule issues on the **current** draft and logs an event — use this to blank out imported rows before running suggestions on the same draft.
- **New blank draft** creates another `ClaimDraft` for the same encounter (newest draft is the one the page shows).

## Environment variables (local)

`apps/platform-app/next.config.ts` loads **`apps/platform-app/.env.neon`** when that file exists (values **override** the same keys from `.env`). You can keep Build AI and DB secrets in `.env.neon` without using `.env.local`.

**Restart** the dev server after editing `.env.neon`.

Required for Build AI (testing):

- `BUILD_AI_TESTING_ENABLED=1` (or `true` / `yes`)
- `OPENAI_API_KEY=…`
- Optional: `BUILD_OPENAI_MODEL`, `BUILD_AI_MISSING_RATE_FALLBACK_CENTS`, `OPENAI_CHAT_MODEL`

See also `apps/platform-app/.env.neon.example`.

## Production (e.g. app.anang.ai on Vercel)

The live site **does not read a file from your laptop**. For `app.anang.ai` you must set the **same variable names** in the Vercel project’s **Settings → Environment Variables**, for **Production** (and Preview if you test there). Typical names:

| Name | Example | Notes |
|------|---------|--------|
| `BUILD_AI_TESTING_ENABLED` | `1` | Must be present on the **runtime** that serves Production |
| `OPENAI_API_KEY` | `sk-…` | Server-only; never `NEXT_PUBLIC_*` |
| `DATABASE_URL` | Neon URL | Already required for the app |
| `BUILD_OPENAI_MODEL` | optional | Falls back to `OPENAI_CHAT_MODEL` / default |
| `BUILD_AI_MISSING_RATE_FALLBACK_CENTS` | optional | e.g. `1500` |

**Checklist so a change actually appears in the browser**

1. **Merge and deploy the code** that contains Build AI (queue banner, encounter page panel, `next.config` changes). If Production is still on an older Git commit, you will see no UI change no matter what env vars you set.
2. In Vercel, open the **latest Production deployment** — confirm it is tied to that commit (Deployment details → **Source**).
3. After **adding or changing** env vars, trigger a **new deployment** (**Redeploy** from the deployment menu, or push a commit). Env vars are applied when a new server instance is built/started; editing vars alone does not always re-sever old instances.
4. Confirm variables are enabled for **Production** (not only Preview).
5. Hard-refresh the site (`Ctrl+Shift+R`) or try an incognito window to avoid a stale tab.

On Production, if `.env.neon` is not in the deployed bundle (usual when gitignored), that is expected — **dashboard env vars are the source of truth**.

## Where to click in the app (no manual URLs)

1. Sign in, open your org (`/o/<orgSlug>/...`).
2. Go to **Build** — **Build — encounter queue** (`/o/<orgSlug>/build`).
3. When Build AI is enabled, an **amber banner** appears at the top explaining testing mode.
4. Each row has a primary button **Review encounter & draft** and a **linked patient name** — both go to the encounter workspace (`/o/<orgSlug>/build/encounters/<encounterId>`).
5. On that page, the **Build AI — testing mode** card has **Suggest draft from encounter**, **New blank draft**, and **Clear draft lines (testing)**.

If the queue shows **no encounters**, import or seed data for that tenant first.

## How to trigger (synthetic app)

1. Apply migrations on the synthetic-testing database (`db:migrate:deploy:neon` or equivalent).
2. Ensure synthetic data is loaded and fee rates derived: `db:derive:synthetic-fees:neon` (after import).
3. Set environment variables in `.env.neon` (local) and/or Vercel (Production) as above.
4. Open **Build**, then **Review encounter & draft** on a row. Use **Suggest draft from encounter** (and optionally clear lines or create a blank draft first).
5. Review rule output and use **Approve claim draft** — approval remains **human-only**; there is no autonomous submission.

## Retrieval and scope

There is **no** broad unbounded RAG in this phase. Context is bounded to encounter narrative (and the fixed system prompt). Optional future hooks can add small, controlled reference snippets; synthetic fee resolution is a table lookup, not embedding search.

## Intentionally deferred (production path)

- Real client **fee schedules**, **payer contracts**, and **encounter-specific rate** engines replacing the synthetic schedule.
- Production **BAA-covered** inference routing and prompt governance beyond version strings.
- Granular **accept/reject** UX per `BuildSuggestionLine` and compliance workflows.

The intent is to **swap** the fee resolution layer (`resolveSyntheticChargeCents` and data sources) while keeping the suggestion → draft line → rules → human approval sequence.

## Troubleshooting: `OpenAI HTTP 400`

- **GPT-5.x / o-series models:** These reasoning models often **reject** a custom `temperature` (only default is allowed) and may expect **`max_completion_tokens`** instead of **`max_tokens`**. The platform Build AI client omits `temperature` and uses the right limit field when the configured model id starts with `gpt-5`, `o1`, `o3`, `o4`, etc.
- If errors persist, read the **full message** returned in the UI (the API error body is surfaced after fixes) or check Vercel/server logs for `build.ai.openai_http`.
- **`response_format: json_object`** requires a model that supports JSON mode on Chat Completions; use a current snapshot if you override `BUILD_OPENAI_MODEL`.

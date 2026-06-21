# Anang — Implementation Plan

**Company:** Anang · [anang.ai](https://anang.ai)
**Mission:** The AI-native revenue cycle platform. Reduce claim denial rates. Collect more from patients with an AI agent.

**For full product context:** `docs/PLATFORM_OVERVIEW.md`
**For phased delivery plan:** `docs/ROADMAP.md`
**For patient app:** `docs/PATIENT_APP.md`

---

## Two Products

### Product 1: Claims AI

Reduces insurance claim denial rates from the industry average of 40–60% to ~20% over time.

**How it works:**
- Encounter data arrives from EHR (FHIR R4, CSV, or manual entry)
- AI reviews every draft claim through four layers before submission:
  1. **Deterministic rules** — Payer-specific edits, missing fields, CPT/ICD consistency
  2. **Retrieval** — Payer bulletins, your own denial history, CPT/HCPCS references
  3. **Predictive scoring** — Denial probability per payer/code pair, trained on your historical claims
  4. **AI explanation** — Plain-English rationale for every flag, for staff review
- Staff approves or dismisses; AI never submits without human approval
- Denied claims are parsed (CARC/RARC codes), categorized, routed, and AI drafts appeals

**Staff UI routes in platform-app:**
- `/o/[orgSlug]/build` — Claims worklist and AI suggestions
- `/o/[orgSlug]/connect` — EHR connectors, 835 remittance, prior auth
- `/o/[orgSlug]/insight` — Denial trends, payer analytics, AR aging

### Product 2: Patient Pay

Mobile-first patient billing with a conversational AI agent.

**How it works:**
- Staff sends patient a magic link (SMS or email)
- Patient opens the Expo mobile app (iOS/Android) or web portal
- AI agent explains the bill in plain English, answers questions, suggests assistance programs
- Patient pays via Stripe (card, Apple Pay, Google Pay, ACH) or enrolls in a payment plan
- Health system sees payment in real time

**Patient UI surfaces:**
- `apps/patient-app` — Native iOS/Android (Expo 52)
- `/p/[orgSlug]/pay/[token]` in platform-app — Web fallback (same data, same Stripe)

---

## Architecture

```
anang.ai              ← apps/marketing-site (Next.js 15)
app.anang.ai          ← apps/platform-app  (Next.js 15 + Prisma + Next-Auth)
  /o/[orgSlug]/*      ← Staff workspace (Claims AI, Pay mgmt, Analytics)
  /p/[orgSlug]/*      ← Web patient portal (magic link, web Stripe)
  /api/patient/*      ← Patient mobile API (Bearer token, JSON)
  /admin/*            ← Super-admin (tenant management)
iOS/Android app       ← apps/patient-app (Expo 52 + Stripe Payment Sheet)
```

**Database:** Neon PostgreSQL via Prisma ORM. Multi-tenant: every query scoped via `tenantPrisma(orgSlug)`.

**Auth:**
- Staff: Next-Auth v5 — magic link email + per-tenant OIDC/SAML
- Patient: HMAC-signed token (`createPatientPayToken`) delivered via SMS/email magic link; stored in `expo-secure-store` on mobile

---

## Module Entitlements

Each health system (Tenant) has ModuleEntitlement rows that gate features:

| ModuleKey | What it enables |
|-----------|----------------|
| `CORE` | Always on — tenant settings, audit, identity |
| `BUILD` | Claims AI — pre-denial review, AI suggestions, encounter coding support |
| `PAY` | Patient Pay — statements, magic links, mobile API, Stripe |
| `CONNECT` | EHR/EDI — FHIR sync, 837/835, clearinghouse, prior auth tracking |
| `INSIGHT` | Analytics — denial trends, payer performance, AR aging |
| `SUPPORT` | Staff support task queue, escalations |
| `COVER` | Financial assistance — Medicaid screener, charity care, patient assistance tab |

---

## Data Model (Key Entities)

### Revenue Cycle (Claims AI)
- `Encounter` — Clinical visit; source of truth for what was done
- `ClaimDraft` → `Claim` → `Claim837EdiSubmission` — Claim lifecycle
- `BuildSuggestionRun` — AI review session on a draft claim
- `BuildRulePack` — Payer-specific rule set
- `BuildKnowledgeChunk` — Retrieved reference material (payer bulletins, SOPs)
- `Remittance835` — ERA/EOB from payer (includes denial reason codes)
- `PriorAuthCase` — PA tracking workflow

### Patient Pay
- `Statement` — Patient-facing bill (balance, due date, status)
- `StatementLine` — Individual charges on the statement
- `Payment` — Recorded payment (Stripe, cash, etc.)
- `StatementPaymentPlan` — Installment plan (offered/acknowledged/cancelled)
- `Coverage` — Patient's insurance coverage details
- `Patient` — Demographic record (linked to Encounter and Statement)
- `PatientPortalIdentity` — Tracks magic link sessions
- `PatientPushSubscription` — Expo push token for notifications

### Platform
- `Tenant` — One health system / clinic
- `ModuleEntitlement` — Which products the tenant has licensed
- `User`, `Membership` — Staff accounts
- `AuditEvent` — Immutable audit trail (all patient data access, payments, AI actions)

---

## AI Implementation

### Claims AI — Four Layers (Never LLM-Only)

**Layer 1: Deterministic**
- No external AI calls. Pure rule evaluation.
- Catches: missing required modifiers, CPT/ICD combination errors, gender/age mismatches, place of service errors, bundling violations
- Runs in milliseconds; blocks submission when severity = ERROR

**Layer 2: Retrieval**
- Vector search over `BuildKnowledgeChunk` (payer bulletins, LCD/NCD policies, tenant SOPs)
- Returns supporting evidence for each flag
- Runs in <2 seconds; requires no LLM

**Layer 3: Predictive Score**
- Classical ML model per tenant, trained on their historical claims + remittances
- Outputs: denial probability (0–1), underpayment risk, which payer rule most likely to trigger
- Trained monthly as data accumulates; starts as heuristic, improves to neural over time

**Layer 4: Generative Explanation**
- LLM (OpenAI / Azure OpenAI) generates staff-facing explanation for each flag
- Only called after Layers 1–3; never the source of billing truth
- Azure OpenAI preferred for BAA-covered environments

### Patient Pay — AI Agent

- Patient asks a question in natural language
- Server resolves to most relevant statement line(s)
- `explainStatementLine({ code, description, amountCents })` called for relevant lines
- Response synthesized into conversational answer
- Escalation: if AI cannot answer confidently, response includes billing phone number
- PHI handling: minimal-payload mode (code + amount only, not description) unless explicitly disabled

---

## Compliance

| Area | Requirement | Implementation |
|------|-------------|---------------|
| HIPAA | BAA with all AI/cloud vendors touching PHI | Azure OpenAI (BAA available) preferred; OpenAI consumer API only in minimal-payload mode |
| PHI in logs | No raw PHI in application logs | `platformLog()` wrapper strips sensitive fields; structured audit trail only |
| PCI | No card data stored | Stripe hosts all card data; we store only `stripePaymentIntentId` |
| TCPA | Patient SMS consent | Consent captured before first SMS; documented in `Patient.smsConsent` |
| AI transparency | Staff must approve AI output before claim submission | No silent auto-submit path exists in codebase |
| SOC 2 | Type II controls | Phase 2 evidence collection |

---

## Integration Strategy

### EHR Connectors (Connect module)
1. **FHIR R4** — Epic (open.epic.com sandbox for demo; production via Epic App Orchard), athenahealth, Oracle Health
2. **Proprietary REST** — Greenway Intergy (research documented in `docs/CONNECTOR_STRATEGY.md`)
3. **CSV/XLSX fallback** — Manual export from any PM system; processed via `IngestionBatch`
4. **Direct database** — On-prem clients with dedicated environments (later)

### Clearinghouse (Connect module)
- **Target:** Availity or Change Healthcare for 837 submission, 277 status, 835 ERA
- **Pattern:** Connector adapter per clearinghouse; UI agnostic to which one is configured

### EHR priority order
1. Epic (largest market share, best FHIR compliance, App Orchard = distribution)
2. athenahealth (strong FHIR R4, REST webhooks)
3. Oracle Health (Cerner) — FHIR R4
4. Greenway Intergy — proprietary; research pending

---

## Engineering Conventions

- **Tenant scoping:** Always `tenantPrisma(orgSlug)`. Never `db` without a tenant filter.
- **Patient API auth:** Bearer token from `Authorization` header. Verify with `verifyPatientPayToken()`. No cookie gate for mobile.
- **Brand strings:** `getBrand()` from `@anang/brand`. Never hardcode "Anang" in UI.
- **AI calls:** Wrap in try/catch with template fallback. AI unavailability must not block the page.
- **Stripe:** Server-side only (`getStripe()` from `@/lib/stripe-server`). Never expose secret key to client.
- **Logging:** `platformLog(level, event, metadata)` — never log PHI fields directly.

---

## Key Files

| Purpose | File |
|---------|------|
| Patient token create/verify | `apps/platform-app/src/lib/patient-pay-token.ts` |
| Multi-tenant Prisma | `apps/platform-app/src/lib/prisma.ts` |
| Bill explanation AI | `apps/platform-app/src/lib/bill-line-explain.ts` |
| Stripe server init | `apps/platform-app/src/lib/stripe-server.ts` |
| Patient mobile API | `apps/platform-app/src/app/api/patient/*/route.ts` |
| Mobile API client | `apps/patient-app/src/lib/api.ts` |
| Brand config | `packages/brand/src/config.ts` |
| Prisma schema | `apps/platform-app/prisma/schema.prisma` |

---

*Last updated: 2026-06-19 — Rewritten around two-product vision: Claims AI + Patient Pay.*

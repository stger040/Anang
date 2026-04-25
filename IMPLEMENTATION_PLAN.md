# Anang — Patient Financial & Revenue Cycle Platform — Implementation Plan

**Company:** **Anang** — [anang.ai](https://anang.ai). **Cedar-class** breadth with Anang’s focus as an **RCM intelligence layer** (not an EHR): **Build** (deterministic-first + retrieval + narrow ML + optional explanations), **Connect**, **Insight**, patient **Pay / Cover / Support / Core**, and full RCM scope including clearinghouse-style connectivity.

**Onboarding summary:** [`docs/PLATFORM_OVERVIEW.md`](docs/PLATFORM_OVERVIEW.md). **Branding in code:** [`packages/brand/src/config.ts`](packages/brand/src/config.ts). **EHR test data:** [`docs/EPIC_AND_TEST_DATA.md`](docs/EPIC_AND_TEST_DATA.md). **Checklist:** [`docs/FULL_PLATFORM_CHECKLIST.md`](docs/FULL_PLATFORM_CHECKLIST.md). **Needs from principals:** [`docs/DEVELOPMENT_NEEDS.md`](docs/DEVELOPMENT_NEEDS.md). **Naming / env overrides:** [`docs/BRANDING.md`](docs/BRANDING.md).

---

## Cedar Reference — What the Market Offers

*Based on [The Brand Hopper's Cedar analysis](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/) and cedar.com.*

### Cedar's Products (Market Benchmark)

| Cedar Product | What It Does |
|---------------|--------------|
| **Cedar Pay** | Post-visit billing, digital invoices, EOB/HSA integration, payment plans, automated outreach. Median digital payment rate rises from ~48% to ~73%. |
| **Cedar Cover** | Insurance gaps → Medicaid/ACA enrollment, pharma assistance. Connects uninsured/underinsured to coverage. *Plus* (per cedar.com): **reactive denials resolution** — patient-facing CoB, dual coverage workflows after claim denied. |
| **Cedar Support** | Call center + **Kora AI** voice agent. ~30% of billing calls automated. Agent Copilot, outbound lists, digital collections. |
| **Cedar Pre** | Pre-visit engagement: cost estimates, appointment reminders, upfront deposits/copays. |
| **Cedar Orthodontics** | Dental/ortho vertical (launched late 2024). |

### Denied Claims — Clarification

**The Brand Hopper article does not mention denied claims.** It focuses on Cedar Cover as "coverage" (Medicaid, ACA). Cedar.com confirms Cedar Cover includes **Denials Resolution** — reactive, patient-facing workflows for CoB, dual coverage, workers comp, etc.

| | Cedar | Us |
|--|-------|-----|
| **Reactive** (after denial) | ✅ Cedar Cover — patient resolves CoB, dual coverage | ✅ Same — Cover module |
| **Proactive** (before submission) | ❌ Cedar does not offer | ✅ **Claims Build Assistant** — provider/scribe coding support |

**We keep both.** Reactive denials resolution (Cover) + proactive denial prevention (Claims Build). This is a stronger offering than Cedar for health systems focused on reducing denial rates.

---

## Executive Summary

Cedar.com offers a **unified patient financial experience platform** that combines **five core product areas** into **one integrated system**. It is **one platform**, not five separate software products—but each product area is a distinct **module/service** within that platform.

**Important clarification — Cedar’s Denials approach:** Cedar Cover provides **reactive** denials resolution: *after* a claim is denied, it helps *patients* resolve issues (e.g., coordination of benefits, dual coverage) so the claim can be reprocessed. Cedar does **not** offer provider-side tools to **prevent** denials before submission.

**Our differentiation:**
1. **Build (Claims Build Assistant)** — **Not LLM-first:** a **multi-layer intelligence system** — (1) deterministic validation and payer-aware rules that run with **models disabled**, (2) **retrieval** over code sets, payer bulletins, and tenant SOPs, (3) **narrow predictive** scores when data and governance allow, (4) **optional LLM** layer for explanations and staff-facing language only. Reduces denials *before* submission; Cedar does not headline this.
2. **Patient experience + Support** — Plain-language billing education (e.g. statement lines), **guardrailed** Support tools and escalation — **separate** from Build’s core logic. See **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**.

This document provides:
1. **EHR Integration** — How the platform connects to Epic, athena, Oracle Health, and what data flows.
2. **Client Experience** — What clinics/hospitals see and use (patient portal, provider dashboards, claims build workflow).
3. **Build** — Proactive denial prevention: **deterministic rules + retrieval + narrow ML + optional LLM explanations** for providers/scribes (**not** LLM-first).
4. **Long-term roadmap** — Phased implementation for the full platform.

**How we execute engineering** (repo shape, CI/CD, quality, teams): see **`BUILD_PLAN.md`**.

---

## Strategic architecture — RCM intelligence layer (authoritative)

**Positioning:** Anang is an **AI-powered healthcare revenue cycle platform**: workflow and **intelligence** that integrates with **existing** EHRs, PM, clearinghouses, and payer processes. It is **not** an EHR replacement.

### Build — four layers (do not collapse into “the LLM”)

1. **Layer 1 — Deterministic engine** — Claim validation, missing-field checks, coding consistency, payer-specific edits, denial-reason normalization, underbilling heuristics, pre-submit warnings, severity/confidence scores. **Must operate with external LLMs disabled.**
2. **Layer 2 — Retrieval / grounding** — CPT/HCPCS/ICD references, payer bulletins, internal SOPs, clinic guidance, historical denial patterns — **structured knowledge**, not pure generation.
3. **Layer 3 — Narrow predictive models** — Denial likelihood, underbilling opportunity, reimbursement variance, workqueue prioritization, collection prioritization — **classical/ML**, not required to be LLMs.
4. **Layer 4 — Generative explanation** — Summaries, conversational wording, UI copy — **on top of** Layers 1–3, never the sole source of billing truth.

**Planning:** [`docs/CORE_DATA_MODEL.md`](docs/CORE_DATA_MODEL.md), [`docs/CONNECTOR_STRATEGY.md`](docs/CONNECTOR_STRATEGY.md), [`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`](docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md).

### Support — separate AI system

**Support** is a **tool-driven**, **retrieval-grounded**, **heavily guardrailed** assistant for **billing support** (statements, balances, payment paths, assistance workflows) with **human escalation**. It must **not** give medical advice, definitive coverage determinations, reimbursement promises, or unconstrained autonomous agency. **Do not** share Build’s rule engine or “coding authority” prompts with Support.

### Onboarding — calibration, not naive foundation-model training

Onboarding means **system mapping**, **schema mapping**, **workflow discovery**, **rule calibration**, **retrieval source setup**, **shadow mode**, **instrumentation**, **threshold tuning**, and **evaluation** before promoting automation — a **client-tuned intelligence layer**, not “train a new general model from scratch in six weeks.”

### Connect integration — connectors first-class

**Connectors** (EHR/PM, claims/remittance, CSV fallback, future clearinghouse) are **product infrastructure**. First concrete integration target: **Greenway** (product/SKU TBD); **Intergy** may appear — **research** documented in **`docs/CONNECTOR_STRATEGY.md`** before locking one API style.

### HIPAA / PHI and AI boundaries

Treat billing and claim line **descriptions** as **sensitive**. Architecture must support **template-only** and **minimal-payload** modes, migration to **BAA-covered** inference, and **provider swap** without rewriting core product logic.

---

## Part 0A: EHR Integration — How It Works

### Data Flow Overview

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   EHR/EMR       │ ──────► │  Our Platform        │ ──────► │  Patient /      │
│  (Epic, athena, │  sync   │  (Integration Layer) │  serve  │  Provider UI    │
│  Oracle Health) │ ◄────── │                      │ ◄────── │                 │
└─────────────────┘  post   └──────────────────────┘  post   └─────────────────┘
                                     │
                                     ▼
                              ┌─────────────────┐
                              │  Clearinghouse  │
                              │  (Payers)       │
                              └─────────────────┘
```

### What Flows *From* the EHR *To* Our Platform

| Data Type | Purpose | Typical Method |
|-----------|---------|----------------|
| **Patient demographics** | Identity, contact, insurance | HL7 v2, FHIR, or batch CSV |
| **Encounters/visits** | Visit dates, provider, location | HL7, FHIR, or batch |
| **Charges/line items** | CPT codes, units, diagnosis | Charge export, FHIR $chargeitem |
| **Clinical documentation** | Notes, diagnoses (for Claims Build) | FHIR Condition, Observation; or HL7 |
| **Insurance info** | Payer, member ID, group | Demographics/eligibility feed |
| **Payments (posting)** | Payments received in EHR | Optional sync back |

### What Flows *From* Our Platform *Back To* the EHR (or Billing System)

| Data Type | Purpose | Typical Method |
|-----------|---------|----------------|
| **Payment postings** | Patient-paid amounts | API or batch file to PM system |
| **Claims Build suggestions** | AI-recommended codes, alerts | API to billing module or sidecar UI |
| **Statement status** | Sent, viewed, paid | Optional; for reconciliation |

### Integration Methods (By EHR)

| EHR | Integration Option | Notes |
|-----|-------------------|-------|
| **Epic** | Epic App Orchard, FHIR API, Chronicles Interface | Epic has strict certification; FHIR R4 common |
| **athenahealth** | MDP (More Disruption Please) API, athena one | REST API; well-documented |
| **Oracle Health (Cerner)** | FHIR API, Cerner Open Developer Experience | FHIR-based |
| **Other** | HL7 v2 file drops, SFTP batch, custom API | Depends on vendor |

### Where We Sit in the Workflow

- **Patient-facing:** We replace or augment the EHR’s patient billing portal. Patients get our URL (or embedded iframe) for bills and payments.
- **Provider-facing:** We provide dashboards and the Claims Build Assistant. The Claims Build Assistant can be:
  - **Embedded** in the EHR (Epic Smart App, athena widget) — ideal
  - **Standalone web app** — staff uses our UI alongside EHR
  - **API-driven** — we send suggestions to the EHR/billing system; staff works in EHR

---

## Part 0B: Client Experience — What Clinics/Hospitals See

### 1. Patient Experience (End Users of the Health System)

| Touchpoint | What They See |
|------------|---------------|
| **Patient portal** | Clean bill view, line items, “Explain this charge” with medical AI, payment options |
| **Email/SMS** | Billing reminders, links to portal |
| **Pay flow** | One-click payment, payment plans, Apple Pay, etc. |
| **Chat / AI assistant** | “What’s this charge?” “Why was this denied?” Plain-language answers |
| **App (PWA)** | Same experience, installable on phone |

### 2. Provider / Staff Experience (Revenue Cycle, Billing, Front Desk)

| Touchpoint | What They See |
|------------|---------------|
| **Admin dashboard** | Collections, patient engagement, payment rates, aging AR |
| **Operator portal** | Patient lookup, manual adjustments, payment posting, notes |
| **Call center view** | (If using Cedar Support–style) Agent workspace with patient context |
| **Claims Build Assistant** | **NEW** — Encounter-level view with AI suggestions, denial-risk alerts |

### 3. Claims Build Assistant — Provider View (NEW)

**Who uses it:** Scribes, coders, billing staff, sometimes providers.

**What they see:**

| Element | Description |
|---------|-------------|
| **Encounter queue** | List of encounters ready for coding/claim build |
| **Clinical summary** | Chief complaint, history, exam, assessment (from EHR or notes) |
| **AI-suggested codes** | CPT, ICD-10, modifiers based on documentation |
| **Documentation gaps** | “Medical necessity may be questioned—add X to note” |
| **Prior auth alerts** | “Procedure X often requires prior auth for Payer Y” |
| **Denial-risk score** | Pre-submission risk based on payer rules, coding patterns |
| **One-click apply** | Accept AI suggestions and push to billing system |

**Workflow:** Staff reviews encounter → sees AI suggestions and alerts → edits or accepts → submits claim. Denials are reduced because documentation and coding are corrected *before* submission.

---

## Part 0C: Cedar vs. Us — Denials

| | Cedar | Us |
|--|-------|-----|
| **Denials Resolution** | ✅ Yes — *after* denial | ✅ Yes — same patient-facing flows |
| **Denials Prevention** | ❌ No | ✅ **Claims Build Assistant** — before submission |
| **Who it helps** | Patient (fix CoB, dual coverage) | Provider/scribe (better coding, docs) |
| **When** | After claim denied | Before claim submitted |
| **Outcome** | Recover revenue on denied claims | Reduce denial rate; fewer claims denied |

---

## Part 0: 1-Week Presentation MVP

**Goal:** A polished, demo-ready product you can present to potential health clients in one week. Not production-grade—but impressive, functional, and differentiated by medical AI.

### What We Build in 7 Days

| Day | Focus | Deliverables |
|-----|-------|--------------|
| **Day 1** | Project setup, UI shell | Next.js + Tailwind, patient portal layout, routing, mock auth |
| **Day 2** | Bill display, sample data | Statement view with mock bills (realistic CPT codes, line items) |
| **Day 3** | Medical AI assistant | Chat widget powered by GPT-4 with medical/billing context—explains line items, codes, terminology |
| **Day 4** | Payment flow | Stripe (test mode), pay full or partial, success/thank-you states |
| **Day 5** | PWA + polish | Installable app (PWA), mobile-responsive, loading states, error handling |
| **Day 6** | Provider demo view | Simple admin/dashboard showing “provider view” (patient counts, sample metrics) |
| **Day 7** | Presentation prep | Demo script, key slides, one-pager, deploy to Vercel |

### 1-Week Tech Stack (Minimal, Fast)

| Layer | Choice | Why |
|-------|--------|-----|
| **Frontend** | Next.js 14 + Tailwind | Fast, SSR, great DX |
| **Auth** | Mock/simple (email in URL or hardcoded demo user) | No real auth in 1 week |
| **Database** | None (or JSON file / in-memory) | Mock data only |
| **Payments** | Stripe Test Mode | Real payment UX, no real money |
| **AI** | OpenAI API (GPT-4) | Medical-context prompting, no training needed |
| **Deploy** | Vercel | One-click, free tier |
| **App** | PWA (next-pwa or similar) | Install to home screen, works offline-capable |

### 1-Week Feature Scope (What *Not* to Build)

- ❌ Real EMR integration  
- ❌ Multi-tenancy  
- ❌ HIPAA compliance  
- ❌ Native iOS/Android app  
- ❌ Real payer data  
- ✅ Everything else is “good enough” for a demo  

### Presentation Talking Points (What to Say in the Demo)

| Moment | What to Show | What to Say |
|--------|--------------|-------------|
| **Bill view** | Patient sees a realistic statement | “Patients get a clear, easy-to-read bill—no more cryptic line items.” |
| **“Explain this charge”** | Click a line item → medical AI explains | “Here’s our differentiator: AI that explains what each charge means in plain language. Cedar doesn’t do this.” |
| **Chat** | “What’s a deductible?” or “Why was this denied?” | “Patients can ask anything—medical or billing. One assistant, full context.” |
| **Pay** | Complete a test payment | “One-click payment, flexible options. Same as Cedar—but with the AI layer on top.” |
| **Install app** | Add to home screen on phone | “Works as an app. Install from the browser—no app store needed yet.” |
| **Provider view** | Simple dashboard | “Providers get visibility. This is where we scale to full analytics.” |

**One-liner:** *“We do what Cedar does for patient billing—plus a medical-context AI that helps patients actually understand their bills. Less confusion, fewer calls, happier patients.”*

---

### App Strategy: PWA First

For the 1-week timeline, we use a **Progressive Web App (PWA)**:

- Works on iOS and Android
- “Add to Home Screen” = app-like icon
- Offline-capable for viewing cached bills
- No app store submission
- Same codebase as web

**Later:** React Native or Flutter for native app stores when you need deeper device features or app-store presence.

---

## Part 1: AI Differentiation Strategy

### The Gap: Cedar vs. Us

| Cedar’s AI | Our Addition |
|------------|---------------|
| Financial only: bills, payments, collections | **Financial + Medical context** |
| Bill summaries (what you owe) | **What each charge means clinically** |
| Kora: billing support voice | **Clinical + billing support** |
| Propensity to pay | Propensity + **explainability** |

### Medical Library AI: Where It Adds Value

A **medical-context AI assistant** (trained or prompted with medical terminology, CPT/ICD codes, procedures) provides:

| Use Case | Value to Patient | Value to Health Client |
|----------|------------------|------------------------|
| **“What is this charge?”** | “This $450 is for your colonoscopy—a procedure that examines your colon. Here’s what typically happens…” | Fewer confused calls, faster resolution |
| **CPT/ICD code translation** | “99213 = office visit, 30 mins, moderate complexity” | Less “mystery line item” frustration |
| **Insurance terminology** | Plain-language explanation of deductible, EOB, coinsurance | Better informed patients, fewer disputes |
| **Prior auth questions** | “Prior authorization means your insurer must approve this before you get it. Here’s what you might need to do…” | Fewer calls to billing office |
| **“Why wasn’t this covered?”** | Context on common denial reasons + next steps | Reduced disputes, clearer expectations |

### Where to Integrate Medical AI (Across Services)

| Service | Integration Point | Complexity |
|---------|-------------------|------------|
| **Pay** | Inline “Explain this line” on each statement line item | Low |
| **Pay** | Chat widget: “Ask about your bill” | Low |
| **Claims Build** | CPT/ICD suggestions, documentation gaps, medical necessity | High |
| **Support** | Agent copilot: suggests medical-context responses | Medium |
| **Voice AI** | Voice answers with medical context for common questions | Medium |
| **Cover** | Explains Medicaid/ACA eligibility and next steps | Medium |
| **Bill Summaries** | Auto-generated summaries with procedure context | Low |

**Recommendation:** Patient-facing: bill line-item explanation + chat widget. Provider-facing: **Claims Build Assistant**—medical AI that prevents denials.

### Implementation Approach (Keep It Simple)

- **Week 1:** Use **GPT-4 with a strong system prompt** + RAG over a small medical/billing knowledge base (CPT codes, common procedures, insurance terms). No fine-tuning.
- **Later:** Add RAG over your own docs (provider-specific procedures, FAQs).
- **Later:** Consider fine-tuned or domain models (e.g. PubMed/Biomedical LMs) for deeper medical accuracy—only if needed.

---

## Part 2: Product Breakdown

| Product | Purpose | Key Capabilities |
|---------|---------|-----------------|
| **Intelligence** | AI/ML Core | Personalization, propensity models, analytics, A/B testing |
| **Pay** | Patient Payments | Pre/post-visit billing, payments, plans, ML discounts, HSA/FSA |
| **Cover** | Coverage & Aid | Medicaid/ACA enrollment, renewal, **reactive** denials resolution |
| **Support** | Customer Support | Call center, early-out, omnichannel, agent tools |
| **Voice AI** | Voice Agent | 24/7 voice support, intent detection, handoff |
| **Claims Build** | **Proactive denial prevention** | **AI assists providers/scribes with coding, documentation, medical necessity—before submission** |
| **Pre** | Pre-visit engagement | Cost estimates, reminders, upfront deposits/copays (Cedar Pre equivalent) |
| **Connect** | Claims submission & remittance | Clearinghouse, 837/835/277, scrubbing, claim status *(see Part 2E)* |
| **Denials (RCM)** | Payer denials in billing | Work queues, appeals, root-cause—not the same as Cover’s patient CoB flows |
| **Implementation** | Deployment | EHR integration, data specs, 3–6 month go-live |

**Our differentiation — Claims Build Assistant:** Provider-facing medical AI *before* submission. **Complete catalog:** Part 2E (Prior Auth, Eligibility, GFE, financial assistance, cash/credits, collections, platform API, etc.).

---

## Part 2B: Business Model & Revenue (Cedar Benchmark)

*Per [The Brand Hopper](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/), Cedar uses enterprise SaaS + outcome-based fees.*

| Revenue Stream | Cedar Model | Our Option |
|----------------|-------------|------------|
| **Subscription / license** | 50–70% of revenue; per provider or per encounter | Same — annual/monthly platform fee |
| **Transaction / collection fees** | 1–4% of patient payments collected through platform | Same — align incentives with collections lift |
| **Implementation & services** | 5–15%; setup, integration, training | Same — one-time go-live fees |
| **Premium add-ons** | 5–15%; AI modules (Kora), Cover, analytics | Same — Claims Build, Voice AI, Cover as tiers |

**Pricing alignment:** Outcome-based fees (e.g., % of collections) align our success with the client's—strong pitch for health systems.

---

## Part 2C: Competitive Landscape

*Key competitors per [The Brand Hopper](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/):*

| Competitor | Focus | Our Differentiation |
|------------|-------|---------------------|
| **RevSpring / AccuReg** | Legacy billing, statements, payments | Modern UI, AI, Claims Build (denial prevention) |
| **Experian Health / Patientco** | Cost estimation, payment processing | Full-suite + medical AI + Claims Build |
| **Phreesia** | Pre-visit intake, check-in, payments (~$356M rev) | We focus post-visit billing + Claims Build; complement vs. replace |
| **Epic Cheers** | Epic's own patient payment (MyChart) | Standalone platform; Claims Build; multi-EHR |
| **Inbox Health** | Consolidated patient bills across providers | Deeper provider integration, Claims Build |
| **Flywire, Paytient, InstaMed** | Payments, financing, processing | We add engagement, AI, denial prevention |

**Our positioning:** Full patient financial experience (Pay, Cover, Support, Pre) **plus** Claims Build Assistant (proactive denial prevention) and medical-context AI. No competitor offers the full combination.

**Future verticals (Cedar precedent):** Cedar launched **Cedar Orthodontics** (dental) in 2024. **Anang Dental** is defined as a **vertical package**, not a forked codebase: same Pay / Cover / Support / Build / Connect / Insight / Core spine, tuned for **CDT**, **treatment plans / installments**, **family/guarantor** billing, and **DMS/PMS** paths (e.g. Dentrix-class) — full buyer + engineering story in **`docs/MODULES_CUSTOMER.md`** § *Dental vertical* and checklist items in **`docs/FULL_PLATFORM_CHECKLIST.md`**. Optional Prisma **`DENTAL`** `ModuleKey` can follow when contracts need an explicit entitlement bit; **behavioral health** or other verticals would follow the same pattern once core RCM + patient financial depth is stable.

---

## Part 2D: Service Completeness — Previously Missing Capabilities

The following were **implicit or partial** in earlier versions. They are now **first-class services** so the platform matches what enterprise revenue-cycle and compliance teams actually need—not only patient engagement.

| Module | Why It Matters | Patients vs. Staff |
|--------|----------------|-------------------|
| **Connect (EDI & claims ops)** | Without 837/835/277 and clearinghouse connectivity, we are a “pretty portal” only. Health systems need submission, remittance posting, and claim status. | Staff / billing |
| **Denials Management (RCM)** | *Cover* handles **patient-facing** CoB/dual coverage. **RCM denials** are payer rejections in billing: work queues, appeal letters, root-cause reporting, correction resubmission. | Staff |
| **Prior Auth** | Claims Build **alerts** (deterministic heuristics) + **Connect → Authorizations** **tracks** PA cases (checklist, status, expirations, encounter/claim links) — **Phase 1 shipped** in repo; payer portals / ePA / auto decisioning remain roadmap — **`docs/PRIOR_AUTHORIZATION.md`**. | Staff (+ patient status optional) |
| **Eligibility & benefits** | Real-time **270/271** (or API) at check-in or pre-service avoids wrong payer, reduces denials and patient surprises. | Staff (+ Pre) |
| **Transparency & estimates** | **No Surprises Act** good-faith estimates (GFE), bundled service estimates, disclaimers—required for many providers and expected in Pre. | Patient + staff |
| **Financial assistance** | Charity care / sliding scale **screening**, applications, approvals—pairs with Cover; reduces bad debt and supports mission. | Patient + staff |
| **Cash posting & reconciliation** | Match bank deposits to batches; align portal payments with GL/PM system; reduce “orphan” payments. | Staff |
| **Refunds & credit balances** | Compliance and patient trust: identify overpayments, workflow approval, issue refund or apply to open balance. | Staff |
| **Bad debt & agency** | Rules to **write off** or **transfer** accounts to collections vendor; file exports; cease outreach when required. | Staff |
| **Trust & consent** | NPP / billing comms **consent**, opt-out audit trail, suppression lists (TCPA/Email). | Patient + compliance |
| **Access & equity** | **i18n** (languages), **WCAG 2.1** accessibility, readable statements for aging populations. | Patient |
| **White-label & config** | Per-tenant logo, colors, domain, statement templates, business rules without code deploys. | Admin |
| **Platform API & webhooks** | **REST/GraphQL** + **webhooks** for EHR, partners, and custom workflows—sellable to IT. | Integrations |

---

## Part 2E: Full Service Catalog (What We Ship)

| # | Service | One-line purpose |
|---|---------|------------------|
| 1 | **Intelligence** | Analytics, personalization, A/B tests, ML propensity |
| 2 | **Pre** | Estimates, reminders, deposits; **GFE / transparency** |
| 3 | **Pay** | Statements, plans, payments, HSA/FSA, discounts |
| 4 | **Cover** | Medicaid/ACA, renewal, financial assistance; **reactive** patient denials (CoB, etc.) |
| 5 | **Support** | Omnichannel outreach, call center, agent tools, early-out |
| 6 | **Voice AI** | Voice agent + copilot patterns |
| 7 | **Claims Build** | Proactive denial prevention for providers/scribes |
| 8 | **Connect** | Clearinghouse, 837/835/277, scrubbing, claim status |
| 9 | **Denials (RCM)** | Payer denial work queue, appeals, root cause |
|10 | **Prior Auth** | PA intake, tracking, payer integration where available |
|11 | **Eligibility** | 270/271 or payer API, benefit display |
|12 | **Cash & Credits** | Posting, reconciliation, refunds, credit balance workflow |
|13 | **Collections** | Bad debt rules, agency handoff |
|14 | **Platform** | Multi-tenant admin, white-label, API, webhooks, audit, i18n/a11y |
|15 | **Implementation** | Data specs, onboarding, training, post-live support |

---

## Part 3: Recommended Tech Stack

### Core principles for enterprise healthcare

- **HIPAA compliance** — Encryption, audit logging, BAAs
- **Scalability** — Multi-tenant, millions of patients
- **Integrations** — EMRs, payers, payment processors
- **Reliability** — 99.9%+ uptime for billing/payments

### Proposed Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend (Patient)** | React/Next.js or Vue/Nuxt | Modern, component-based, SSR for SEO |
| **Frontend (Provider/Admin)** | React + Material UI or Ant Design | Rich dashboards, tables, forms |
| **API Layer** | Node.js (NestJS) or .NET Core | Strong typing, enterprise patterns, HIPAA libraries |
| **Backend Services** | Microservices (Node, .NET, or Go) | Independent scaling, clear boundaries |
| **Database (Primary)** | PostgreSQL | ACID, JSONB, mature, HIPAA-ready |
| **Database (Analytics)** | ClickHouse or Snowflake | High-volume billing/event analytics |
| **Cache** | Redis | Sessions, rate limits, real-time features |
| **Message Queue** | RabbitMQ or Apache Kafka | Async workflows (billing, enrollment) |
| **Search** | Elasticsearch | Full-text, billing/patient search |
| **Payments** | Stripe + custom gateway | Cards, ACH, Apple Pay; healthcare-specific flows |
| **Communications** | Twilio (SMS), SendGrid (Email) | Omnichannel outreach |
| **AI/Voice (Kora-like)** | OpenAI/Azure OpenAI + Vapi or ElevenLabs | Intent, summarization, voice |
| **Infrastructure** | AWS or Azure | Healthcare compliance, regions, HIPAA tools |
| **IaC** | Terraform or Pulumi | Reproducible, auditable infra |

### Alternative (Single-vendor, faster MVP)

- **Supabase** (PostgreSQL, Auth, Storage) for backend and auth
- **Stripe** for payments
- **Vercel** or **Railway** for deployment
- **Resend** or **SendGrid** for email

Start here if you want to validate the product quickly, then evolve toward the full stack above.

---

## Part 4: Phased Implementation Plan (Post–Week 1)

### Phase 0: Foundation (Months 1–3)

**Goal:** Shared platform, data model, infra, and first minimal flow.

| # | Task | Deliverables |
|---|------|--------------|
| 0.1 | Project setup | Mono-repo, CI/CD, environments (dev/staging/prod) |
| 0.2 | Core data model | Patient, Visit, Claim, Statement, Payment, Coverage, Provider/Tenant |
| 0.3 | Auth & multi-tenancy | Provider registration, SSO-ready, tenant isolation |
| 0.4 | Base API | REST/GraphQL gateway, auth middleware |
| 0.5 | EMR integration skeleton | HL7/FHIR/API adapter pattern, first Epic or athena connector |
| 0.6 | HIPAA baseline | Encryption at rest/transit, audit logs, BAA docs |

---

### Phase 1: Cedar Pay — Core Payments (Months 4–8)

**Goal:** Patients can see bills and pay online.

| # | Task | Deliverables |
|---|------|--------------|
| 1.1 | Statement generation | Bill creation from claims, line items, payer/patient responsibility |
| 1.2 | Patient portal | Login, view statements, payment history |
| 1.3 | Payment processing | Stripe integration (cards, ACH, Apple Pay), PCI handling |
| 1.4 | Payment plans | Auto-pay, promise-to-pay, plan rules (min/max, duration) |
| 1.5 | Pre-visit (Pre) | Cost estimates, reminders, upfront deposits/copays before visit |
| 1.6 | IVR and phone payments | Basic IVR tree for payments |

---

### Phase 2: Cedar Pay — Advanced (Months 9–12)

| # | Task | Deliverables |
|---|------|--------------|
| 2.1 | Payer integration | Deductible, EOB (250+ payers via Change Healthcare or similar) |
| 2.2 | HSA/FSA | Plaid or Health Equity integration, balance checks |
| 2.3 | ML discounts | Likelihood-to-pay model, discount suggestions |
| 2.4 | AI bill summaries | Bill explanation in plain language |
| 2.5 | Operator portal | Staff view for patient billing, manual adjustments |
| 2.6 | Point-of-service | In-person payment flows (kiosk/tablet/QR) |

---

### Phase 3: Omnichannel Communications (Months 10–14)

**Goal:** Reach patients via email, SMS, paper, and digital.

| # | Task | Deliverables |
|---|------|--------------|
| 3.1 | Email billing | Statement emails, reminders, templates |
| 3.2 | SMS | Twilio integration, opt-in/opt-out, reminders |
| 3.3 | Paper statements | PDF generation, print/mail service (e.g. Lob) |
| 3.4 | Abandoned flow reminders | Triggers when payment flow is left incomplete |
| 3.5 | Channel preferences | Patient preferences (email/SMS/paper) |
| 3.6 | Personalization engine | Communication timing and channel optimization |

---

### Phase 4A: Build — Proactive Denial Prevention (Months 10–16)

**Goal:** **Layered intelligence** so providers and scribes ship cleaner claims *before* submission — **core logic works with LLMs disabled**.

| # | Task | Deliverables |
|---|------|--------------|
| 4A.0 | Core data + connector readiness | Canonical entities per **`docs/CORE_DATA_MODEL.md`**; ingest/mapping per **`docs/CONNECTOR_STRATEGY.md`** |
| 4A.1 | Encounter + charge ingestion | Encounters + clinical/charge sources from EHR/PM (FHIR, HL7, API, or batch per tenant) |
| 4A.2 | **Rules engine v1** | Missing-field checks, coding consistency, payer edits, pre-submit warnings, severity scores — **persisted with rule IDs** |
| 4A.3 | **Retrieval / knowledge** | Grounding for CPT/ICD, payer bulletins, SOPs — **citations** surfaced in UI where possible |
| 4A.4 | Documentation gap detection | Deterministic + retrieval-backed “add X for medical necessity” (LLM may **phrase** only) |
| 4A.5 | Prior auth alerts | Rule + retrieval: “procedure X often requires PA for payer Y” |
| 4A.6 | **Narrow scores (shadow)** | Denial likelihood / underbilling heuristics — **evaluate before promotion** |
| 4A.7 | Build UI | Encounter queue, issues with explainability, human accept/reject, **no silent auto-submit** |
| 4A.8 | **Optional LLM explanation layer** | Paraphrase rule outputs + staff UX copy; **separate** from Support assistant design |
| 4A.9 | Recommendation / outcome logging | Audit trail: what fired, what staff did — supports compliance and model iteration |

---

### Phase 4B: Cover — Coverage & Aid (Months 14–20)

| # | Task | Deliverables |
|---|------|--------------|
| 4B.1 | Medicaid screening | Eligibility screening flows (per state) |
| 4B.2 | Medicaid enrollment | Digital application, document upload, status tracking |
| 4B.3 | ACA Marketplace | Enrollment workflows, subsidy estimation |
| 4B.4 | Renewal workflows | Deadlines, reminders, renewal steps |
| 4B.5 | **Reactive** denials resolution | CoB, workers comp, dual coverage—patient-facing workflows |
| 4B.6 | Live advocate support | Chat/phone routing to advocates |
| 4B.7 | State-specific logic | 50-state Medicaid rules and variations |

---

### Phase 5: Cedar Support — Call Center (Months 15–21)

| # | Task | Deliverables |
|---|------|--------------|
| 5.1 | Agent workspace | Call center UI with patient context |
| 5.2 | Inbound routing | IVR, queue, skills-based routing |
| 5.3 | Patient context panel | Billing history, payments, coverage, notes |
| 5.4 | Early-out services | Proactive outreach lists, payment reminders |
| 5.5 | Outbound campaigns | Campaign management, call lists |
| 5.6 | Agent copilot | Suggested responses, billing summaries |

---

### Phase 6: Kora AI — Voice Agent (Months 18–24)

| # | Task | Deliverables |
|---|------|--------------|
| 6.1 | Voice platform | Vapi, ElevenLabs, or custom Telephony + STT/TTS |
| 6.2 | Call authentication | Identity verification (e.g. DOB, MRN) |
| 6.3 | Intent detection | Billing intents (balance, payment, plan, dispute) |
| 6.4 | Billing knowledge base | RAG over billing data for answers |
| 6.5 | Human handoff | Escalation with full context |
| 6.6 | Outbound Kora | AI-led outbound calls for collections |
| 6.7 | Sentiment analysis | Real-time empathy and escalation triggers |

---

### Phase 7: Cedar Intelligence — AI/ML Core (Parallel: Months 6–24)

| # | Task | Deliverables |
|---|------|--------------|
| 7.1 | Event pipeline | Bill/payment/engagement events into analytics |
| 7.2 | Patient propensity models | Likelihood-to-pay, churn, engagement |
| 7.3 | Personalization API | Next-best-action, channel, timing |
| 7.4 | A/B testing framework | Experiments on messaging and flows |
| 7.5 | Reporting & dashboards | Collections, engagement, coverage metrics |
| 7.6 | Continuous learning | Model retraining from outcomes |

---

### Phase 8: Implementation & Operations (Ongoing)

| # | Task | Deliverables |
|---|------|--------------|
| 8.1 | Data specs & templates | Standard integration specs for EMRs |
| 8.2 | Build guides | Step-by-step integration guides |
| 8.3 | Testing toolkits | Test data, validation scripts |
| 8.4 | Root System (best practices) | Pre-configured tenant templates |
| 8.5 | Go-live checklist | Readiness, cutover, rollback |
| 8.6 | Post-live support | Monitoring, SLAs, optimization |

---

### Phase 9: Connect — EDI, Clearinghouse & Claim Lifecycle (Months 12–20)

**Goal:** Operational claim submission and cash posting—not only patient statements.

| # | Task | Deliverables |
|---|------|--------------|
| 9.1 | Clearinghouse integration | Partner (e.g. Change Healthcare, Availity, Waystar); enroll, test 837/835 |
| 9.2 | 837 generation & scrub | Build 837 from charges; edit rules; error reports |
| 9.3 | 835 ERA ingestion | Post payments and adjustments to claim line level |
| 9.4 | 277/claim status | Inquiry and dashboards for “payer received / pended / paid” |
| 9.5 | Payer configuration | Payer IDs, routing, submission windows per tenant |

---

### Phase 10: RCM Denials, Prior Auth & Eligibility (Months 14–22)

| # | Task | Deliverables |
|---|------|--------------|
| 10.1 | **Eligibility** | 270/271 or payer API; store snapshots; surface in Pre/operator portal |
| 10.2 | **Prior Auth** | **Phase 1 (shipped):** `PriorAuthCase` + checklist/services/events, **Connect → Authorizations**, Build deterministic signals, Implementation settings, SLA cron — **`docs/PRIOR_AUTHORIZATION.md`**. **Later:** payer-specific Q&A flows, richer attachment store, portal/API automation. |
| 10.3 | **RCM denials inbox** | Import 835 denials / payer portals; categorize (CO, PR, OA, etc.) |
| 10.4 | Appeals & tasks | Templates, deadlines, reassignment, outcome tracking |
| 10.5 | Root-cause analytics | Denials by reason, payer, provider, CPT—feed Intelligence |

*Complements **Cover** (patient-driven CoB) and **Claims Build** (pre-submission prevention).*

---

### Phase 11: Cash, Credits, Collections & Transparency (Months 16–24)

| # | Task | Deliverables |
|---|------|--------------|
| 11.1 | **Cash posting & reconciliation** | Batch deposits, mismatch detection, GL export hooks |
| 11.2 | **Refunds & credit balances** | Rules engine, approval workflow, payment trace |
| 11.3 | **Bad debt & agency** | Account tagging, file export to vendor, regulatory holds |
| 11.4 | **GFE / transparency** | Scheduled services estimate templates, patient acknowledgment, audit trail |
| 11.5 | **Financial assistance** | Screening questionnaire, policy tiers, approval routing (ties to Cover) |

---

### Phase 12: Platform Hardening — API, Trust, Access (Parallel: Months 6–24)

| # | Task | Deliverables |
|---|------|--------------|
| 12.1 | **Public API & webhooks** | Tenant-scoped keys; events (payment.posted, claim.denied, etc.) |
| 12.2 | **White-label** | Brand assets, domains, email sender, statement PDF themes |
| 12.3 | **Consent & suppression** | Billing comms preferences; audit; export for compliance |
| 12.4 | **i18n & a11y** | Locale packs, WCAG 2.1 AA checks on patient flows |
| 12.5 | **Rate limits & abuse** | Per-tenant quotas, bot protection on portal |

---

## Part 5: Architecture — One Platform, Multiple Services

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROVIDER ADMIN PORTAL                                │
│  (Configuration, Reporting, Tenant Management)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY / BFF                                    │
│  (Auth, Rate Limiting, Tenant Resolution)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────┼───────────────────┼───────────────────┐
        │                       │                   │                   │
        ▼               ▼               ▼               ▼               ▼
┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│ PAY/PRE   │   │ COVER     │   │ SUPPORT   │   │ CLAIMS    │   │ CONNECT   │
│           │   │           │   │           │   │ BUILD     │   │ 837/835   │
└───────────┘   └───────────┘   └───────────┘   └───────────┘   └───────────┘
        │               │               │               │               │
        │         RCM: Denials · Prior Auth · Eligibility (billing staff)   │
        └───────────────────────────────┼───────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER (Shared)                              │
│  - Personalization  - Propensity Models  - Analytics  - A/B Testing         │
│  - Medical AI: patient bill explanations + Claims Build (provider coding)   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KORA AI (Voice Agent) + Medical Context                  │
│  - STT/TTS  - Intent  - Handoff  - Medical + billing explanations          │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
        ▼                               ▼                               ▼
┌───────────────┐             ┌───────────────┐             ┌───────────────┐
│   PostgreSQL  │             │    Redis      │             │  Elasticsearch │
│   (Primary)   │             │   (Cache)     │             │   (Search)     │
└───────────────┘             └───────────────┘             └───────────────┘
```

---

## Part 6: Regulatory & Compliance Checklist

| Requirement | Approach |
|-------------|----------|
| **HIPAA** | BAA with infra provider; encryption; access controls; audit logs |
| **PCI-DSS** | Stripe-hosted elements; no card storage; scope reduction |
| **SOC 2** | Controls, monitoring, periodic audits |
| **No Surprises Act //CMS rules** | GFE generation, estimate disclaimers, retain artifacts; legal review for formats |
| **State Medicaid** | Per-state eligibility and enrollment flows |
| **TCPA (SMS/Calls)** | Consent, opt-out, frequency limits |
| **CAN-SPAM / email** | Unsubscribe, physical address, suppression |
| **FDCPA (Collections)** | Early-out and collections process compliance |
| **ADA / accessibility** | WCAG 2.1 AA target for patient flows |
| **State charity care** | Where mandated, financial assistance policy templates and documentation |

---

## Part 7: Team & Timeline Estimate

| Phase | Duration | Minimum Team |
|-------|----------|--------------|
| **Phase 0 (1-Week MVP)** | 1 week | 1 developer (or 2 for polish) |
| Phase 0 (Production) | 3 months | 2 engineers, 1 architect |
| Phase 1 | 5 months | 3–4 engineers, 1 designer |
| Phase 2 | 4 months | 3–4 engineers |
| Phase 3 | 5 months | 2–3 engineers |
| Phase 4 | 6 months | 3–4 engineers + healthcare domain expert |
| Phase 5 | 6 months | 2–3 engineers |
| Phase 4A (Claims Build) | 6 months | 2–3 engineers + coding/clinical expert |
| Phase 6 | 6 months | 2 AI/voice specialists |
| Phase 7 | Ongoing | 1–2 data scientists |

**1-Week Presentation MVP:** 1 developer, 7 days  
**Total to Production MVP (Phases 0–1):** ~8 months with a small team  
**Full platform (all phases):** 24–36 months with 8–12 people

---

## Part 8: Suggested Build Order

*Prioritize **auditability** and **connector + canonical data** foundations before expanding generative surfaces.*

1. **Phase 0 (Production)** — **Anang core data model** (normalized entities, external ID maps), auth, multi-tenancy, **connector interface + CSV/FHIR paths**, HIPAA baseline — see **`docs/CORE_DATA_MODEL.md`**, **`docs/CONNECTOR_STRATEGY.md`**.
2. **Phase 12 (early slices)** — White-label basics, audit logging, consent flags (grow with each release).
3. **Phase 1** — Core Pay + thin Pre (estimates/deposit placeholder).
4. **Build scaffolding** — **Rules engine v1** + recommendation/outcome persistence on existing `ClaimDraft` / issues (**LLMs optional**).
5. **Medical AI 1.x (Pay)** — Bill line **explanation** with template + provider abstraction evolution — **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**.
6. **Phase 9 (pilot)** — Connect with one clearinghouse + one tenant (required for “real” RCM stories).
7. **Phase 4A** — Build depth: retrieval, shadow scoring, payer calibration per onboarding philosophy.
8. **Phase 3** — Omnichannel communications.
9. **Phase 10** — Eligibility, Prior Auth, RCM denials inbox (start with eligibility + denial import).
10. **Phase 7** — Intelligence (propensity, dashboards, denial root-cause).
11. **Phase 2** — Advanced Pay (payers, HSA/FSA, ML discounts).
12. **Phase 11** — Cash/credits, GFE/financial assistance depth, collections rules.
13. **Phase 5** — Support: **guardrailed**, tool-driven assistant + escalation (**not** Build’s engine).
14. **Phase 6** — Voice AI.
15. **Phase 4B** — Cover (Medicaid/ACA, reactive patient denials).
16. **Phase 8** — Scale implementation playbooks as customer count grows.
17. **Phase 0 (1 Week)** — *Optional legacy demo slice* — only if needed for fundraising; do not confuse with production foundation.

---

## Part 9: Success Metrics (Cedar Benchmarks)

| Metric | Cedar Claim | Target |
|--------|-------------|--------|
| Collections rate increase | 22% Y1 | 15–20% |
| Patient satisfaction | 89% | >85% |
| Digital payment rate | 81% | >70% |
| Agent handle time reduction | 27% | 20–25% |
| Inbound call autonomous resolution | 95% | 80%+ |
| Medicaid approval rate | 97% | 90%+ |
| **Claim denial rate reduction** (Claims Build) | *Cedar does not offer* | 15–30% target |
| **First-pass clean claim rate** (Connect + Claims Build) | Industry benchmark | +5–15 pts |
| **Denial overturn / appeal success** (RCM Denials) | Varies by payer | Track & improve YoY |

---

## Part 10: Next Steps

### This Week (1-Week MVP)

1. **Kick off Day 1** — Create Next.js project, set up Tailwind, define patient portal layout.
2. **Prepare demo data** — 2–3 realistic mock bills with CPT codes and line items.
3. **Set up OpenAI** — API key, system prompt for medical-context bill explanations.
4. **Stripe test mode** — Create test account, implement payment flow.
5. **PWA config** — Add `next-pwa` or similar for installable app experience.

### After the 1-Week Demo

1. **Confirm tech stack** for production — Node vs .NET, AWS vs Azure.
2. **Scope Phase 0** — Real data model, first EMR target, HIPAA baseline.
3. **Compliance roadmap** — HIPAA, PCI, TCPA with legal/compliance.
4. **Create repo structure** — Mono-repo with `services/`, `apps/`, `packages/`.
5. **Production infra** — Terraform for dev, staging, prod.

---

*Document Version: 5.1 | Strategic architecture: Build = layered intelligence (not LLM-first); Support = separate guardrailed assistant; connectors + core data model — see `docs/CORE_DATA_MODEL.md`, `docs/CONNECTOR_STRATEGY.md`, `docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`. Full service catalog (Part 2D–2E), Connect/EDI, RCM denials, Prior Auth, Eligibility, cash/credits, collections, transparency, platform API — see BUILD_PLAN.md for execution.*

# Platform Overview — Anang

**Purpose:** Bring any engineer or AI agent up to speed on what Anang is, what it does, and where everything lives.

**Company:** Anang · [anang.ai](https://anang.ai) · [app.anang.ai](https://app.anang.ai)

---

## 1. What Anang Does (One Paragraph)

Anang is an **AI-powered healthcare revenue cycle platform** with two products sold together to health system administrators — CFOs, VPs of Revenue Cycle, and Practice Managers:

1. **Claims AI** — Reduces insurance claim denial rates from the industry average of 40–60% down to 20% over time. An AI layer sits between the clinical encounter and claim submission, catching coding errors, missing documentation, payer-specific rule violations, and prior auth gaps *before* the claim goes out the door. When denials still happen, a second AI workflow routes them to the right staff member with a suggested appeal response.

2. **Patient Pay** — A mobile-first patient billing experience with an AI agent that helps patients understand their bill, qualify for financial assistance, and pay. Designed to look and work like Cedar.com's patient financial platform — but with conversational AI that Cedar does not yet offer. Health systems earn more from patient collections because patients actually understand and pay what they owe.

---

## 2. Who Buys It

- **Primary buyer:** CFO / VP Revenue Cycle at a hospital, health system, or large physician group
- **Contract:** B2B SaaS with the health system; patients use it for free
- **Sales motion:** Direct enterprise sales, pilot-first approach (6-week pilots)
- **Pricing model:** Platform fee + success-fee on patient collections

---

## 3. The Two Products

### Product 1: Claims AI

**Problem it solves:** The average health system has a 40–60% claim denial rate, costing $262B/year in the U.S. Most denials are preventable — coding errors, missing modifiers, wrong diagnosis specificity, prior auth not obtained.

**How it works:**
1. Encounter data arrives (via EHR integration or manual entry)
2. Claims AI runs four layers of analysis:
   - **Layer 1 – Deterministic rules:** Missing fields, CPT/ICD consistency, payer edits — no AI needed
   - **Layer 2 – Retrieval:** Payer bulletins, denial history, your own SOPs
   - **Layer 3 – Predictive scoring:** Denial likelihood per payer/code combination based on your historical data
   - **Layer 4 – AI explanation:** Plain-English rationale for every flag, for staff review
3. Staff reviews flagged issues and approves or dismisses before submission
4. Over time the system learns which claim patterns succeed with which payers — denial rate falls

**Denials workflow:** When claims are denied, the denial reason code (CO-4, CO-11, PR-96, etc.) is parsed, categorized, and routed. AI drafts an appeal template. Staff reviews and submits.

**Staff interface:** A claims worklist with AI-surfaced issues, encounter review panel, payer rules editor, and denial inbox.

### Product 2: Patient Pay

**Problem it solves:** Patients receive confusing bills they don't understand, don't pay, and the health system writes off the balance. Cedar has shown this is solvable with good UX and outreach — median digital payment rate goes from ~48% to ~73%.

**Our differentiator over Cedar and Epic MyChart:** Neither offers a conversational AI agent that *talks* to the patient, explains every line item, screens for Medicaid/charity care eligibility in real time, and closes the payment — all without calling billing.

**How it works:**
1. Health system sends patient a text/email with a magic link (no app download required for web)
2. Patient taps link → opens mobile app or web portal
3. AI agent greets them, explains their bill in plain English, suggests payment plan or assistance programs
4. Patient pays (Stripe, Apple Pay, bank transfer) or enrolls in assistance
5. Health system sees payment in real time; AR balance drops

**Patient interface:** Expo (iOS + Android) native app plus responsive web. Four tabs:
- **My Bill** — Balance, charges, payments made
- **Coverage** — Insurance details, deductible/OOP progress
- **Assistance** — Medicaid screener, charity care, prompt-pay discounts
- **Account** — Settings, sign out

---

## 4. What We Are NOT

- **Not an EHR.** We integrate with Epic, athenahealth, Oracle Health, Greenway, etc. via FHIR/API/CSV.
- **Not a clearinghouse.** We connect to clearinghouses (Availity, Change Healthcare) via their APIs.
- **Not a practice management system.** We layer on top of what the health system already has.

---

## 5. Technical Architecture

### Apps in the Monorepo

| App | URL | Purpose |
|-----|-----|---------|
| `apps/marketing-site` | anang.ai | Public marketing, product pages |
| `apps/platform-app` | app.anang.ai | Staff workspace (billers, coders, admins) |
| `apps/patient-app` | Native iOS/Android + deep links | Patient billing app (Expo React Native) |

### Shared Packages

| Package | Purpose |
|---------|---------|
| `packages/brand` | Brand tokens, product names, company config — single source of truth |
| `packages/config` | Shared TypeScript/ESLint config |
| `packages/ui` | Shared React components (web) |

### Stack

- **Next.js 15** (platform-app, marketing-site) with React 19 and TypeScript
- **Expo ~52** (patient-app) with Expo Router, React Native 0.76
- **Prisma + Neon PostgreSQL** — multi-tenant via `tenantPrisma(orgSlug)`
- **Next-Auth v5** — magic links + per-tenant OIDC/SSO
- **Stripe** — patient payments (Checkout for web, Payment Sheet for mobile)
- **OpenAI / Azure OpenAI** — bill explanations, AI agent responses

### Module Entitlements

Each tenant (health system) has `ModuleEntitlement` rows that gate product access:

| ModuleKey | Maps to | Controls |
|-----------|---------|---------|
| `BUILD` | Claims AI — pre-denial | Claims worklist, AI review, encounter coding |
| `PAY` | Patient Pay | Patient portal, statements, Stripe payments |
| `CONNECT` | EHR/clearinghouse connectors | FHIR sync, 837/835 EDI, prior auth tracking |
| `INSIGHT` | Analytics dashboard | Denial trends, payer performance, AR aging |
| `SUPPORT` | Billing support tools | Staff task queue, escalations |
| `COVER` | Financial assistance | Medicaid screener, charity care workflows |
| `CORE` | Platform core | Always enabled; identity, audit, tenant settings |

---

## 6. Patient App — Auth Flow

The patient app uses **magic links**, not passwords:

1. Staff (or automated workflow) generates a signed token: `createPatientPayToken({ orgSlug, statementId })`
2. Token is sent to patient via SMS or email as a deep link: `anang-patient://pay?org=<slug>&token=<token>`
3. Patient opens the link → app stores token in `expo-secure-store`
4. All API calls use `Authorization: Bearer <token>` — verified server-side with `verifyPatientPayToken()`
5. Token expires in 7 days; patient can request a new link from the login screen

**API routes serving the patient app** (all under `/api/patient/`):

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/patient/summary` | GET | All statements + total balance |
| `/api/patient/statement` | GET | Detailed statement with charges, payments, plan |
| `/api/patient/ask-ai` | POST | AI answer to a billing question |
| `/api/patient/acknowledge-plan` | POST | Accept a payment plan |
| `/api/patient/payment-intent` | POST | Stripe PaymentIntent for mobile SDK |

---

## 7. Cedar Comparison (Key for Sales Conversations)

| Capability | Cedar | Epic MyChart | Anang |
|------------|-------|-------------|-------|
| Digital patient billing | ✅ Core strength | ✅ Built in | ✅ Match |
| Payment plans | ✅ | ✅ | ✅ |
| Financial assistance screening | ✅ Cedar Cover | Limited | ✅ |
| **Conversational AI for patients** | ❌ Not yet | ❌ | ✅ **Differentiator** |
| **Pre-denial claim review (provider)** | ❌ | ❌ | ✅ **Differentiator** |
| **Denial prevention AI training** | ❌ | ❌ | ✅ **Differentiator** |
| EHR-integrated (Epic sidebar) | Partial | Native | Roadmap (SMART on FHIR) |

**The pitch:** Epic MyChart shows patients a bill. Cedar helps them pay it. Anang does both — and prevents the claim from being denied in the first place.

---

## 8. Compliance

- **HIPAA:** PHI only in governed environments with signed BAAs. Audit logging on all patient data access.
- **PCI:** Stripe handles card data; we never store card numbers.
- **TCPA:** SMS outreach governed by consent; legal review before production SMS.
- **AI / PHI:** Bill explanation calls use minimal-payload mode by default (code + amount, not description) unless `OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD=0`. Azure OpenAI preferred for BAA-covered environments.

---

## 9. Development Setup

```bash
npm install
docker compose up -d           # local Postgres
cp apps/platform-app/.env.example apps/platform-app/.env
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
npm run dev                    # starts marketing (3000) + platform (3001)
npm run dev:patient            # starts Expo patient app
```

Marketing: http://localhost:3000
Platform: http://localhost:3001/login
Patient app: Expo Go or `npm run ios` / `npm run android`

---

## 10. Document Map

| File | Read when you need to... |
|------|--------------------------|
| `docs/PLATFORM_OVERVIEW.md` (this file) | Understand the product and architecture |
| `docs/ROADMAP.md` | See the phased delivery plan |
| `docs/PATIENT_APP.md` | Build or debug the Expo patient app |
| `docs/CORE_DATA_MODEL.md` | Understand Prisma models and RCM entities |
| `docs/CONNECTOR_STRATEGY.md` | Work on EHR/clearinghouse integrations |
| `docs/ARCHITECTURE.md` | Deployment topology, app structure |
| `docs/DEPLOYMENT.md` | Vercel, Neon, env vars |
| `docs/TENANCY_AND_MODULES.md` | Multi-tenant patterns, seeding |
| `IMPLEMENTATION_PLAN.md` | Full feature-by-feature delivery plan |
| `AGENTS.md` | Quick-start for AI coding agents |

---

*Last updated: 2026-06-19 — Rewritten around Claims AI + Patient Pay two-product vision.*

# Platform overview — for developers and AI assistants

**Purpose:** Bring a new engineer or AI agent up to speed on what **Anang** is building, why, and where everything lives in the repo.

**Company:** **Anang**  
**Domain:** **https://anang.ai**  
**Market reference:** [Cedar](https://www.cedar.com) — patient financial experience + related services; we aim for a **similar breadth** plus **explicit RCM depth** and **AI differentiation**.

---

## 1. What we are building (one paragraph)

**Anang** is building an **enterprise, multi-tenant SaaS platform** for **U.S. healthcare providers** (health systems, hospitals, large groups) that **unifies the patient financial journey** with a **revenue-cycle intelligence layer** (not an EHR): digital billing and payments, coverage and affordability programs, communications, optional contact center / voice AI, **clearinghouse-style claim connectivity**, and **Build** — **deterministic-first** validation, retrieval, narrow scoring, and **optional** LLM explanations so staff ship cleaner claims. Patients get **Pay / Cover / Support / Core**; staff get **Build / Connect / Insight**. It is **one platform** with **many modules**, sharing tenants, identity boundaries, and analytics.

---

## 2. Who buys it and how it is sold

- **Buyers:** CFO / VP Revenue Cycle, CIO, often Patient Experience; contract is **B2B** with the health system.
- **Delivery:** Primarily **multi-tenant cloud SaaS**; optional dedicated environments for large deals. **White-label** per client (logo, colors, domains) on top of shared code.
- **Distribution:** Direct enterprise sales + long implementations (EHR integration, clearinghouse enrollment). See `BUILD_PLAN.md` §11.

### Product surfaces (where people use the platform)

**Vision:** Deliver **patient** and **staff** experiences on **desktop web**, **mobile web / PWA**, and **native iOS & Android** as modules mature—**one backend**, **parity** for patient Pay / Cover / Support / Core over time. **Transaction / success-fee** economics tie to **Pay** and **attribution**, not to whether the patient used Safari or the store app. Full rationale and a **web vs native** capability framing: **[`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md)**.

**Today’s repo** still centers on **`apps/platform-app`** (authenticated staff web workspace) plus marketing; **patient** Pay flows use **`/p/*`** (token/cookie gate) separate from staff NextAuth. **Roles, route separation, and module-vs-user access** are documented in **[`ACCESS_MODEL.md`](./ACCESS_MODEL.md)**.

---

## 3. Product modules (conceptual — names in code: `packages/brand`)

**Buyer-friendly module list** aligned with Cedar naming (Pay, Cover, Support, Pre) plus Build / Connect / Insight: **[`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md)**.

| Module | Role |
|--------|------|
| **Pre** | Pre-visit estimates, reminders, deposits; **good-faith estimates / transparency** (regulatory posture TBD with counsel). |
| **Pay** | Statements, payment plans, discounts, omnichannel outreach, HSA/FSA display, patient portal, **PWA**. |
| **Cover** | Medicaid/ACA, renewals, financial assistance, **reactive** patient-facing denials resolution (CoB, dual coverage, etc.). |
| **Support** | Early-out, campaigns, **agent workspace**, copilot. |
| **Voice** | AI voice agent for billing (comparable positioning to Cedar’s Kora). |
| **Claims Build** | **Proactive denial prevention**: AI-assisted coding, documentation gaps, prior-auth **alerts**, pre-submit risk — **not** offered by Cedar as a headline. |
| **Connect** | **837 / 835 / 277**, clearinghouse partner, claim lifecycle — **required** for serious RCM, not “portal only.” |
| **RCM denials (billing)** | Payer denial inbox, appeals, root-cause analytics — **complements** Cover’s **patient-side** denials flows. |
| **Eligibility / Prior auth** | 270/271-style eligibility; PA case tracking. |
| **Cash & credits** | Posting, reconciliation, refunds, credit balances, bad-debt / agency handoff rules. |
| **Intelligence** | Events, dashboards, propensity models, personalization, experiments. |
| **Platform** | Multi-tenant admin, **API + webhooks**, consent, i18n/a11y, feature flags per tenant. |

**AI differentiation (two tracks — neither is “LLM decides everything”):**

1. **Patient / Support:** Plain-language billing education and **guardrailed** support (retrieval + tools + escalation); templates / minimal-payload modes for sensitive text — see **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**.  
2. **Staff / Build:** **Rules + retrieval + narrow models** first; LLM as **explanation layer**; human acceptance **before** submit (no silent auto-submit). Core **`docs/CORE_DATA_MODEL.md`** and **`docs/CONNECTOR_STRATEGY.md`**.

---

## 4. Cedar vs Anang (strategic)

| Area | Cedar (benchmark) | Anang intent |
|------|-------------------|--------------|
| Patient pay + engagement | Core strength | **Match** |
| Cover / affordability | Strong | **Match** |
| Support + voice AI | Strong | **Match** |
| Reactive denial help (patient) | Cedar Cover | **Match** |
| **Proactive denial prevention (provider)** | Not a headline | **Differentiator — Claims Build** |
| **Full EDI / Connect** | Partner-dependent; we still **design** first-class Connect | **Explicit module** |
| **Medical-context bill explanation** | Financial-first AI | **Differentiator** |

---

## 5. Technical reality today (repo state)

- **Monorepo:** two Next.js 15 apps — `apps/marketing-site` (public) and `apps/platform-app` (authenticated product at `/o/[orgSlug]/…` plus `/admin`).
- **Shared packages:** `@anang/brand`, `@anang/config`, `@anang/types`, `@anang/ui`, `packages/tsconfig`, etc.
- **Data:** Prisma + **PostgreSQL** (`docker-compose` for local, or Neon per **`DEPLOYMENT.md`**). **`prisma/seed.ts`** currently seeds **one** pilot-style tenant — **`synthetic-test`** — with **all** `ModuleEntitlement` modules enabled and **one** primary patient (Sam) driving a **connected** staff-demo thread (see **`docs/TENANCY_AND_MODULES.md`** § *Staff journey*). Older docs that referenced multiple named demo tenants (e.g. LCO / Tamarack / `demo`) describe **product positioning or past seeds**, not the present default seed file.
- **Implemented (starter):** **Auth.js** — optional **platform OIDC** (`AUTH_OIDC_*`) + **per-tenant OIDC** (admin UI + env secret pattern) + staging **Credentials**; policy **`local_only` / `sso_allowed` / `sso_required`** per tenant (`docs/DEPLOYMENT.md`, `docs/CLIENT_IT_OIDC_ONBOARDING.md`), Build / Pay / Connect / Insight MVPs, **Cover** (**`CoverAssistanceCase`** intake + status) and **Support** (**`SupportTask`** queue) staff workspaces, Pay **pre-visit hub** route (`/pay/pre`), tenant settings + audit, super-admin index; **optional Stripe Checkout + webhook** for Pay when env vars are set (see **`DEPLOYMENT.md`**). **Staff UI cross-navigation** on key pages links **Build ↔ Connect ↔ Pay** when optional FKs are populated (encounter detail → related claim; claim detail → encounter; statement detail → related claim + encounter). **Dental** is a **documented vertical** (Cedar Orthodontics–class): same module spine, dental-tuned UX and integrations — see **`docs/MODULES_CUSTOMER.md`**; optional future **`DENTAL`** `ModuleKey` not in schema yet.
- **Not yet built:** SCIM / platform-wide OIDC JIT, **dedicated patient PWA / native billing apps** (see **`docs/PRODUCT_SURFACES_VISION.md`**, **`docs/PATIENT_SCENARIOS_AND_MOBILE_APP.md`**), production **SMS / magic-link** orchestration, FHIR/EHR feeds-in-production, production clearinghouse, full breadth in **`IMPLEMENTATION_PLAN.md`** — **`docs/FULL_PLATFORM_CHECKLIST.md`**.

**Rule:** Do **not** scatter “Anang” or product copy across random files — use **`getBrand()`** from `@anang/brand` or edit **`packages/brand/src/config.ts`**.

**Pilot / customer sessions:** See **[`CLIENT_SHOWCASE.md`](./CLIENT_SHOWCASE.md)** for URLs, operator sign-in, checks, and current gaps before production.

---

## 6. Compliance and risk (high level)

- **HIPAA:** PHI only in governed environments with **BAAs**; audit logging and encryption expected for production.
- **PCI:** Prefer hosted payment fields (e.g. Stripe); minimize card data scope.
- **TCPA / CAN-SPAM / NSA transparency:** Apply as features go live; **legal review** for GFEs and state balance-billing rules.
- **AI:** Build outputs are **auditable** (rule IDs, retrieval, scores); generative APIs are **swappable**; human review before claim submit; template / minimal-payload paths for PHI-adjacent text — **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**.

Details: `IMPLEMENTATION_PLAN.md` Part 6, `BUILD_PLAN.md` §5–6.

---

## 7. Document map (read order for a new agent)

| Order | File | Contents |
|-------|------|----------|
| 1 | **`docs/PLATFORM_OVERVIEW.md`** (this file) | Vision, modules, Cedar comparison, repo reality |
| 1b | **`docs/PRODUCT_SURFACES_VISION.md`** | Desktop / mobile web / native parity; take-rate vs channel; engineering north star |
| 1c | **`docs/MODULES_CUSTOMER.md`** | Cedar-aligned **Pay / Cover / Support / Pre** + **Build / Connect / Insight / Core / Dental** — same `ModuleKey` set, buyer language |
| 1d | **`docs/PATIENT_SCENARIOS_AND_MOBILE_APP.md`** | Patient vs staff scenarios; SMS → web → verify; app mapping |
| 1e | **`docs/FOUNDER_BUILD_GUIDE.md`** | Neon, seed vs PHI, what non-engineers configure |
| 1f | **`docs/CORE_DATA_MODEL.md`** | Canonical RCM entities, raw vs normalized, module needs, Prisma gaps |
| 1g | **`docs/CONNECTOR_STRATEGY.md`** | Connector categories, Greenway/Intergy research gate, CSV fallback, mapping; commercial pilot table → **`PILOT_CONNECTOR_ROADMAP.md`** / **`EPIC_FHIR_INTEGRATION_PLAN.md`** |
| 1h | **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`** | Bill explain evolution; Build vs Support; provider abstraction |
| 1i | **`docs/ENGINEERING_BACKLOG.md`** | Foundational tickets (data model, Build rules, connectors, AI adapters) |
| 2 | **`docs/ARCHITECTURE.md`** | Marketing + **staff** platform apps today; **patient** shells per roadmap |
| 3 | **`docs/DEPLOYMENT.md`** | Vercel projects, Postgres, env vars |
| 4 | **`docs/TENANCY_AND_MODULES.md`** | Entitlements, seeds, adding clients |
| 4b | **`docs/FIRST_CLIENT_ONBOARDING_6W.md`** | Six-week pilot rhythm; links to in-app **Implementation hub** |
| 5 | **`docs/ROADMAP.md`** | Phased rollout after this starter |
| 6 | **`IMPLEMENTATION_PLAN.md`** | Phased delivery, architecture diagram, regulatory checklist |
| 7 | **`BUILD_PLAN.md`** | Repo layout, CI/cadence, quality, distribution alignment |
| 8 | **`docs/FULL_PLATFORM_CHECKLIST.md`** | Master feature checklist |
| 9 | **`docs/DEVELOPMENT_NEEDS.md`** | What the business must supply (EHR, Stripe, BAAs, etc.) |
| 10 | **`docs/BRANDING.md`** | Env overrides and rename workflow |
| 11 | **`docs/EPIC_AND_TEST_DATA.md`** | Sandboxes vs synthetic data — no “open Epic dumps” |
| 12 | **`packages/brand/src/config.ts`** | Live display strings: **Anang**, suite name, AI labels |

---

## 8. Commands (local dev)

```powershell
npm install
docker compose up -d
Copy-Item apps\platform-app\.env.example apps\platform-app\.env -Force
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
npm run dev
```

Marketing: http://localhost:3000 · Platform: http://localhost:3001/login

---

## 9. Glossary (quick)

| Term | Meaning |
|------|---------|
| **RCM** | Revenue cycle management — billing, claims, cash, denials. |
| **CoB** | Coordination of benefits — common denial / coverage class. |
| **EDI 837/835** | Claim submission / remittance (payment/denial) transactions. |
| **GFE** | Good faith estimate (No Surprises Act context). |
| **Tenant** | One health system / customer org in the database (`Tenant` model). |

---

*Last updated: 2026-04-19 — seed reality (`synthetic-test` only), staff Build/Connect/Pay cross-links, module journey note in `TENANCY_AND_MODULES.md`.*

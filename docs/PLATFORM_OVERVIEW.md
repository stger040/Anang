# Platform overview — for developers and AI assistants

**Purpose:** Bring a new engineer or AI agent up to speed on what **Anang** is building, why, and where everything lives in the repo.

**Company:** **Anang**  
**Domain:** **https://anang.ai**  
**Market reference:** [Cedar](https://www.cedar.com) — patient financial experience + related services; we aim for a **similar breadth** plus **explicit RCM depth** and **AI differentiation**.

---

## 1. What we are building (one paragraph)

**Anang** is building an **enterprise, multi-tenant SaaS platform** for **U.S. healthcare providers** (health systems, hospitals, large groups) that **unifies the patient financial journey** with **provider-side revenue cycle tools**: digital billing and payments, coverage and affordability programs, communications, optional contact center / voice AI, **clearinghouse-style claim connectivity**, **proactive claims-building / denial prevention** for staff, and **medical-context AI** so patients understand bills and staff ship cleaner claims. It is **one platform** with **many modules** (not separate unrelated products), sharing tenants, identity boundaries, and analytics.

---

## 2. Who buys it and how it is sold

- **Buyers:** CFO / VP Revenue Cycle, CIO, often Patient Experience; contract is **B2B** with the health system.
- **Delivery:** Primarily **multi-tenant cloud SaaS**; optional dedicated environments for large deals. **White-label** per client (logo, colors, domains) on top of shared code.
- **Distribution:** Direct enterprise sales + long implementations (EHR integration, clearinghouse enrollment). See `BUILD_PLAN.md` §11.

---

## 3. Product modules (conceptual — names in code: `packages/brand`)

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

**AI differentiation (two tracks):**

1. **Patient:** Explain line items and coverage in plain language (“medical library” RAG + LLM).  
2. **Provider:** Claims Build / copilot — suggestions **accepted by a human** before submit (no silent auto-submit of claims).

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
- **Data:** Prisma + **PostgreSQL** (`docker-compose` for local); seed includes **LCO Health Center**, **Tamarack Health**, and **Demo Tenant** with different `ModuleEntitlement` mixes.
- **Implemented (starter):** Demo cookie auth, Build / Pay / Connect / Insight MVPs, Support & Cover scaffolds, tenant settings + audit placeholders, super-admin tenant index.
- **Not yet built:** Real SSO, Stripe, FHIR/EHR feeds, production clearinghouse, full breadth in **`IMPLEMENTATION_PLAN.md`** — see **`docs/FULL_PLATFORM_CHECKLIST.md`**.

**Rule:** Do **not** scatter “Anang” or product copy across random files — use **`getBrand()`** from `@anang/brand` or edit **`packages/brand/src/config.ts`**.

---

## 6. Compliance and risk (high level)

- **HIPAA:** PHI only in governed environments with **BAAs**; audit logging and encryption expected for production.
- **PCI:** Prefer hosted payment fields (e.g. Stripe); minimize card data scope.
- **TCPA / CAN-SPAM / NSA transparency:** Apply as features go live; **legal review** for GFEs and state balance-billing rules.
- **AI:** Human review for coding suggestions; log model/version where required.

Details: `IMPLEMENTATION_PLAN.md` Part 6, `BUILD_PLAN.md` §5–6.

---

## 7. Document map (read order for a new agent)

| Order | File | Contents |
|-------|------|----------|
| 1 | **`docs/PLATFORM_OVERVIEW.md`** (this file) | Vision, modules, Cedar comparison, repo reality |
| 2 | **`docs/ARCHITECTURE.md`** | Two-app split, tenancy, mock vs prod |
| 3 | **`docs/DEPLOYMENT.md`** | Vercel projects, Postgres, env vars |
| 4 | **`docs/TENANCY_AND_MODULES.md`** | Entitlements, seeds, adding clients |
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

*Last updated: aligns with Anang (anang.ai). Product suite & AI persona names can evolve in `packages/brand`.*

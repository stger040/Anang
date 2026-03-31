# Path to “full” product — Cedar benchmark vs Anang

**Purpose:** Clarify what **“full software”** means next to a Cedar-class platform, what **you can do in this repo**, and what **only your organization** can unlock (contracts, compliance, vendor access). Use this with [`CLIENT_SHOWCASE.md`](./CLIENT_SHOWCASE.md) for demos and [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) for depth.

**External reference:** [The Brand Hopper — Cedar: founders, business model, funding & competitors](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/) (summarizes Cedar’s B2B SaaS model, Pay/Cover/Support/Pre positioning, EHR and payer data integration, outcome-linked pricing themes, and competitive set). This is **secondary analysis**, not Cedar’s official financial statements — use it for **positioning and checklist completeness**, not for investment or legal decisions.

---

## 1. What “full” means (realistically)

| Layer | “Full” implies |
|-------|----------------|
| **Product** | End-to-end **patient financial** + **staff RCM** journeys that work on **live** (or sandbox) data, with **payments**, **comms**, and **ops** behind real SLAs. |
| **GTM** | **Enterprise contracts**, implementation fees, optional **success / transaction** pricing — a business decision, not only code ([Brand Hopper on subscription + collections-linked fees](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/)). |
| **Trust** | **HIPAA**, **BAAs**, **PCI** scope control, security reviews — your legal and infra choices. |

No Git repo alone reaches “full” without **your environment** (DB, IdP, payment processor, EHR sandbox/prod agreements).

---

## 2. Cedar capabilities (from the benchmark article) → Anang today → What to build

The article stresses: **EHR + claims/EOB + patient account data** in one **consumer-grade** flow; products along the journey **Pay**, **Cover** (coverage/affordability), **Support** (incl. AI voice), **pre-visit** engagement; **implementation** and **integration depth** as moat.

| Theme (Cedar-class) | Article / market signal | Anang today | Build next (engineering) | Your end (non-code) |
|----------------------|-------------------------|-------------|---------------------------|----------------------|
| **Enterprise B2B SaaS** | Hospitals contract; scale per system | Multi-tenant ✅; demo auth only | SSO (SAML/OIDC), org provisioning API, audit | MSAs, pricing, SOC2/HIPAA roadmap |
| **EHR / PM integration** | Real-time retrieval of visits, charges, demographics | Seed-only synthetic data | Ingestion workers, FHIR/HL7 adapters, mapping UI, replay DLQ | Epic/athena/Cerner **sandbox + prod** access, **BAA**, interface analysts |
| **Cedar Pay — digital bill + options** | EOB/HSA-aware billing, plans, omnichannel | Pay **MVP** (statements/lines, no live gateway) | Stripe Connect or enterprise gateway, statement PDF, plans, comms prefs | Merchant agreements, **PCI** counsel, brand/comms legal |
| **Cedar Cover — affordability** | Medicaid/ACA, denials resolution positioning | **Scaffold** UI | Eligibility vendors, workflow engine, policy configs per tenant | Payer/navigator partnerships, policy content |
| **Cedar Support — ops + AI** | Kora-style voice, copilot, queues | **Scaffold** + mock KPIs | Ticketing integration, voice (e.g. Twilio + LLM), agent workspace | Call center SOWs, TCPA/consent |
| **Pre-visit** | Estimates, reminders, deposits | Not a first-class module yet | Pre module: estimates API, appointment hooks | **GFE / transparency** counsel (state/federal) |
| **Data / personalization** | ML on outreach timing/channel | Insight **MVP** | Event store, warehouse sync, experiments | Data science hires, governance |
| **Cedar Connect / EDI** (market expectation for “serious RCM”) | Clearinghouse, 837/835/277 | Connect **MVP** (timelines, seeded claims) | Partner certification, submission/recon jobs | Clearinghouse contract, enrollment |
| **Claims Build** (Anang differentiator) | Proactive denial prevention — **not** Cedar’s headline | **MVP** (drafts, AI copy HITL) | Stronger rules engine, evidence linking, submit gates | Payer policy licenses, clinical SME |
| **Verticals** (e.g. ortho) | Article mentions **Cedar Orthodontics** | Single horizontal codebase | Vertical packs (config + templates) | Choose pilot vertical |

---

## 3. What automation / this codebase can keep doing

These are the kinds of things **we can implement in-repo** (subject to your priorities and review):

- **Integration readiness (shipped):** each tenant’s **Settings** page includes an **Integration readiness** card (EHR, payments, comms, clearinghouse) driven only by **optional env vars** — plus **`GET /api/integrations/status`** for the same JSON. No secrets exposed; use it in demos to show what’s mock vs ready.
- **Product surface:** Flesh out Cover, Support, Pre flows; patient-facing portal route group; richer Insight.
- **Integrations (code + patterns):** FHIR sync jobs, webhook receivers, idempotent upserts into Prisma models, admin screens for “last sync / errors”.
- **Payments:** Server-side payment intents, webhooks, reconciliation tables — **after** you choose Stripe vs bank gateway and get keys.
- **Auth:** Replace demo cookie with **NextAuth / Auth0 / Azure AD** patterns, session hardening, RBAC refinements.
- **Ops:** Feature flags per tenant, `/api/health` / version (done), CI, migrations discipline.
- **Docs:** Pilot runbooks, data mapping templates, demo scripts.

---

## 4. What only you can supply (checklist)

Use this when kicking off a pilot:

1. **Legal & compliance** — BAAs, privacy policy for PHI, DPIA, patient comms consent.
2. **Identity** — IdP (Okta, Entra, etc.) or email domain for production auth.
3. **Infrastructure** — AWS/Azure accounts (or stay on Vercel + managed Postgres), secrets vault, backup/DR expectations.
4. **EHR** — Which vendor(s), sandbox credentials, interface specs (FHIR app registration, HL7 VPN endpoints).
5. **Payments** — Processor contract, MID, settlement expectations, who's liable for chargebacks.
6. **Clearinghouse / payer** — Trading partner enrollments for 837/835 if you promise Connect for real.
7. **People** — PM for implementation, RCM SME for Claims Build acceptance criteria, security review owner.

---

## 5. Suggested phases (outcomes, not dates)

| Phase | Outcome your buyers feel |
|-------|---------------------------|
| **A — Now** | Credible **demo** (already): modules, synthetic data, honest scaffolds — [`CLIENT_SHOWCASE.md`](./CLIENT_SHOWCASE.md). |
| **B — Pilot** | **One** EHR sandbox → **read** patients/encounters/charges into Postgres; **one** payment path in **test** mode; SSO for pilot users. |
| **C — Revenue** | Production BAAs, prod EHR feed, live payments (PCI-minimal), basic monitoring and on-call. |
| **D — Scale** | Full Pay/Cover/Support depth, clearinghouse production, analytics warehouse, optional vertical packs. |

---

## 6. Competitors mentioned in the article (context only)

The Brand Hopper piece lists **RevSpring/AccuReg, Experian/Patientco, Paytient, Inbox Health, Flywire, InstaMed (JPM), Epic Cheers, Phreesia**, and others — useful for **positioning**, not for copying features verbatim. Anang’s explicit wedge remains **Claims Build + Connect depth + medical-context AI** alongside patient financial modules (`IMPLEMENTATION_PLAN.md`, Cedar comparison tables).

---

## Summary

- **“Full software”** = **product + integrations + compliance + GTM** together; the repo can grow toward **feature-complete** and **integration-ready**, but **you** unlock data, money movement, and trust boundaries.
- Compared to the **Cedar story** in [The Brand Hopper](https://thebrandhopper.com/featured-startups/cedar-founders-business-model-funding-competitors/), the **largest remaining build blocks** are: **real EHR ingestion**, **production Pay**, **Cover/Support depth**, **pre-visit**, and **warehouse-grade intelligence** — plus **your** vendor and legal stack.

When you’re ready to prioritize one pillar (e.g. “Pilot B: Epic sandbox only”), say so and work can focus on a **narrow vertical slice** instead of boiling the ocean.

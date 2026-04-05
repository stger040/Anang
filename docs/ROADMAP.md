# Roadmap (starter → enterprise)

This document translates the scaffold into a credible production path without committing to premature microservices.

**Module story:** Prisma **`ModuleKey`** entitlements today — **Core, Build, Pay, Connect, Insight, Support, Cover** — with **customer-facing names** in **`docs/MODULES_CUSTOMER.md`**.

**Dental module (vertical):** **Cedar Orthodontics–class** packaging — **same** Pay / Cover / Support / Build / Connect / Insight / Core **spine**, with **dental-specific** workflows and semantics (e.g. **CDT**-native thinking, **treatment plans**, **installments**, **family/guarantor** billing, **DMS/PMS** integration paths such as Dentrix-class). **Not** a separate product silo: it is **how we sell and tune** the suite for dental. **Implementation today:** `Tenant.settings` / feature flags for “dental mode”; **optional future** **`DENTAL`** `ModuleKey` for a hard contract line — see **`docs/MODULES_CUSTOMER.md`** § *Dental vertical*.

**Vision additions** (SMS → web → native, parity across shells) live in **`docs/PRODUCT_SURFACES_VISION.md`** and **`docs/PATIENT_SCENARIOS_AND_MOBILE_APP.md`** — they describe **where** and **how** patients encounter Pay / Cover / Support (including dental overlays).

## Phase 0 — Pilot ready (current repo)

- [x] Split marketing vs platform apps
- [x] Prisma schema + seed tenants with varied entitlements
- [x] Build module MVP (queue, detail, AI rationales, issues, approval)
- [x] Pay / Connect / Insight MVPs with credible UI
- [x] Super admin + tenant settings shell
- [x] Cover + Support staff queues (`CoverAssistanceCase`, `SupportTask`) + Pay `/pay/pre` hub
- [x] Vercel-oriented deployment notes

## Phase 1 — Real auth & org lifecycle

- Replace demo cookie with SSO (OIDC/SAML) and durable sessions (**per-tenant OIDC + policy already ship** in platform-app — tighten defaults for pilots: `sso_required` when IT is ready)
- Self-service org provisioning + billing (Stripe) mapped to `ModuleEntitlement`
- Invites & JIT membership provisioning (invite + JIT paths exist — productize enrollment UX)
- **BAA-aware logging and retention** — document and enforce for any environment that stores or transits **PHI** (`PLATFORM_LOGGING.md`, optional `PLATFORM_LOG_WEBHOOK_URL`); no raw FHIR/clinical payloads in application logs

## Phase 2 — Integrations

- EMR / FHIR or vendor SDK for clinical documentation ingestion (Build)
- Clearinghouse + 837/277/835 processing (Connect)
- Patient payment gateway + PMS/PM posting (Pay) — **platform-app** already supports **Stripe Checkout + webhook** behind env; extend to **patient** shells and **attribution** for success fees per **`PRODUCT_SURFACES_VISION`**
- **Patient channel:** responsive **billing web** (magic links from SMS), then **PWA / native** for parity journeys (Cover + Pay + Support)
- Data warehouse export for Insight (dbt / Snowflake / BigQuery)

## Phase 3 — Intelligence & AI services

- **Build:** rules engine + retrieval (BAA-aware where content is sensitive) + **shadow** narrow scores; **LLM** for explanations only where approved — see **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**
- **Support:** separate tool-driven assistant (not Build’s core engine)
- Model hosting (VPC / Azure OpenAI) aligned to contract; evaluation harness and replay on historical remits
- Human feedback loop for **rules + thresholds + optional models**

## Phase 4 — Enterprise hardening

- Row-level security, field-level encryption where required
- Dedicated environments per client (optional) vs shared multi-tenant with strong isolation
- SOC2 Type II controls aligned to customer security questionnaires

## Principles

- **One platform** — modules share identity, navigation, and data contracts.
- **Modular entitlements** — sales can compose SKUs without forked codebases.
- **Solo-founder friendly** — keep the critical path in one TypeScript repo until revenue funds specialization.

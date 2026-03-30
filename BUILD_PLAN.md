# How We Build This Software — Execution Plan

This document is the **engineering and delivery playbook** companion to `IMPLEMENTATION_PLAN.md`. The implementation plan defines **what** we build (services, phases, compliance). This file defines **how** we build and ship it safely.

---

## 1. Principles

1. **One platform, many modules** — Shared auth, tenant model, events, and UI patterns; avoid one-off silos per product line.
2. **HIPAA-by-design** — No PHI in non-production without BAAs; audit every read/write of PHI; encryption default.
3. **Vertical slice delivery** — Each milestone produces a demoable path (e.g., “mock EHR → statement → pay → post event”), not a layer of empty services.
4. **Buy the commodity, build the differentiator** — Payments (Stripe), SMS (Twilio), clearinghouse (partner EDI), LLM (Azure OpenAI with BAA); build patient UX, workflows, and orchestration.
5. **Pilot then scale** — One health system shape (e.g., multi-hospital IDN vs. large specialty group) per early phase; generalize after two customers.

---

## 2. Repository & Codebase Shape

**Recommended mono-repo** (single version, shared CI):

```text
/
├── apps/
│   ├── patient-portal/          # Next.js — patient PWA
│   ├── provider-admin/         # React — staff, RCM, config
│   ├── claims-build/           # Optional separate app or route group
│   └── api-gateway/            # Or BFF only; heavy logic in services
├── services/
│   ├── tenant-auth/            # IAM, SSO, tenant resolution
│   ├── billing-core/           # Statements, charges, payments
│   ├── integrations-ehr/       # FHIR/HL7 adapters
│   ├── connect-edi/            # 837/835 (when Phase 9 starts)
│   ├── communications/         # Email/SMS orchestration
│   ├── intelligence-events/    # Events → warehouse / ML
│   └── ai-assistants/          # RAG, prompts, voice adapters
├── packages/
│   ├── ui/                     # Shared design system
│   ├── types/                  # OpenAPI-generated TS types
│   └── eslint-config/
└── infra/                      # Terraform / Pulumi, k8s, etc.
```

**Alternative for first 6 months:** Single **NestJS + Next.js** repo with module boundaries inside NestJS namespaces until traffic forces service split.

---

## 3. Environments & Release Train

| Environment | Purpose | PHI |
|-------------|---------|-----|
| **Local** | Developer machines | Synthetic only |
| **Dev** | Shared unstable integration | Synthetic / scrubbed |
| **Staging** | Pre-prod, EHR cert sandbox | Client test patient only under BAA |
| **Production** | Live tenants | Real PHI |

**Cadence:**

- **Trunk-based main** with short-lived branches; feature flags for risky modules.
- **Weekly** internal demo from `main` (even if behind flags).
- **Biweekly** tagged release to staging; **monthly** production release until maturity, then align with customer change windows.

---

## 4. Development Workflow

1. **Design brief** — One-pager: user, problem, success metric, scope, out-of-scope.
2. **API-first (internal)** — OpenAPI or protobuf schema reviewed before large UI build.
3. **Migrations** — Database changes only via versioned migrations (e.g. Flyway, Prisma migrate).
4. **PR checklist** — Tests for critical paths; no secrets; PHI logging scan; accessibility spot-check for patient UI changes.
5. **Definition of Done** — Feature behind flag or documented; monitoring hook (log/metric); runbook snippet if ops-heavy.

---

## 5. Quality: Testing & Security

| Layer | Minimum bar |
|-------|-------------|
| **Unit** | Domain rules: pricing, plan eligibility, idempotency keys on payments |
| **Contract** | EHR adapter contracts; webhook payloads |
| **E2E** | Synthetic journey: login → bill → pay (staging) |
| **Load** | Before major releases on API gateway and payment endpoints |
| **Security** | Dependency scan, SAST, annual pen test before large enterprise deals |
| **HIPAA** | Annual risk assessment; access review; incident response drill |

**AI-specific:** Human review path for coding suggestions in Claims Build; never auto-submit claim without explicit user acceptance; log model version and prompt hash for audit.

---

## 6. Observability & Operations

- **Structured logs** — Correlation ID per request; tenant ID on every log line in prod.
- **Metrics** — Payment success rate, webhook failures, EDI reject rate, portal error rate.
- **Alerts** — Pager only for payment processing and auth; daytime slack for EDI delays.
- **Runbooks** — Clearinghouse down, Stripe webhook replay, failed 835 parse.

---

## 7. Team Roles (Scaling)

| Phase | Core roles |
|-------|------------|
| **0–6 mo** | Tech lead / full-stack ×2, product-minded engineer ×1, designer part-time |
| **6–18 mo** | + backend for EDI, + integrations engineer, + security/compliance part-time |
| **18+ mo** | + ML engineer, + SRE/infra, + dedicated PM, + clinical coding advisor (contract) |

**External:** Healthcare privacy counsel, SOC 2 auditor when sales require it, clearinghouse solution architect.

---

## 8. Delivery Roadmap (Mapped to IMPLEMENTATION_PLAN)

| Quarter | Focus | Exit criteria |
|---------|--------|----------------|
| **Q0** | 1-week MVP | Deployed demo; stakeholder feedback |
| **Q1** | Production foundation + Pay v0 | Multi-tenant auth; HIPAA baseline; one real integration path behind NDA |
| **Q2** | Pay v1 + comms + Eligibility pilot | Statements from real or sandbox EHR feed; SMS/email: opt-in compliant |
| **Q3** | Connect pilot + Claims Build v0 | First 837 test submission; AI suggestions in shadow mode |
| **Q4** | RCM denials inbox + cash reconciliation v0 | Denials imported; manual appeal task; deposit reconciliation report |
| **Year 2** | Cover, Support, Voice, depth | Per IMPLEMENTATION_PLAN Phases 4B–6 |

Adjust quarters once first pilot customer is signed—their EHR drives integration order.

---

## 9. Risk Register (Short List)

| Risk | Mitigation |
|------|------------|
| Epic/athena certification delays | Start with FHIR sandbox + one mid-market EHR with lighter process |
| Clearinghouse complexity | One partner, one payer type (e.g., professional) before institutional |
| AI hallucination in coding | Accept/apply UX only; confidence scores; specialty-specific rules packs |
| Long sales cycles | Self-hosted demo + ROI calculator using prospect’s scrubbed metrics |
| Compliance scope creep | Phase “HIPAA minimal product” vs. “SOC 2 Type II” as separate initiative |

---

## 10. What You Do This Month (Concrete)

1. **Lock repo structure** — Mono-repo skeleton; CI running lint + unit on empty modules.
2. **Tenant + patient stub** — `Tenant`, `Patient`, `Statement`, `PaymentIntent` in Postgres; no real EHR yet.
3. **Patient portal slice** — List statements + pay with Stripe test + audit log stub.
4. **OpenAPI** — Published for `billing-core` read APIs.
5. **Staging environment** — Single region, encrypted DB, BAA in place with cloud vendor.

Then execute **IMPLEMENTATION_PLAN.md** Part 8 (Suggested Build Order) sequentially, pulling tasks from Phases 0–12 as prioritized per pilot customer.

---

## 11. Distribution & GTM — Follow-on Steps (Aligned With How We Build)

These steps turn the earlier distribution story into **repeatable motions** and **product decisions**.

### 11.1 First 90 days (sales readiness)

| Week | Action |
|------|--------|
| **1–2** | **Trust pack v0** — Subprocessor list, high-level arch diagram, “where data lives,” encryption at rest/transit, no-PHI-in-logs policy. |
| **3–4** | **Demo tenant(s)** — `demo` + optional second tenant to show white-label (logo + primary color). Same codebase, seeded DB or config. |
| **5–8** | **Pilot SOW template** — Scope: module (Pay + Pre **or** Pay only), milestones, IT checklist, success metrics. |
| **9–12** | **Security questionnaire** — Pre-filled answers from your stack; attach pen test **or** roadmap to first pen test after pilot contract. |

### 11.2 Engineering choices that support distribution

| Need from distribution | What we build |
|------------------------|----------------|
| **Client-branded URLs** | Tenant slug + **white-label** fields (`logoUrl`, `primaryColor`, display name); later: custom domain → same app via host-based tenant resolution. |
| **IT / security review** | **`/api/health`** and **`/api/version`** (build id, commit); no secrets in responses. |
| **Pilot → expansion** | **Feature flags per tenant** (e.g. `connectEdiEnabled`, `claimsBuildEnabled`) in DB or config service. |
| **EHR-led rollout** | **Implementation** runbook: sandbox first, production toggle; tenant-level “go-live date.” |
| **Channel partners** | **Read-only partner API** or export jobs later; same tenant isolation as core API. |

### 11.3 Deployment shape (default recommendation)

1. **SaaS multi-tenant** — One production cluster; rows partitioned by `tenantId` (see repo scaffold). Easiest for you to operate and price.
2. **Optional vanity host** — `pay.healthsystem.org` → CNAME to your edge → resolve tenant by hostname mapping table (phase after first customer).
3. **Dedicated VPC** — Same codebase, single-tenant DB; quote only when contract size justifies ops cost.

### 11.4 What we intentionally defer

- Full **SAML SSO** until a signed pilot names IdP requirements.
- **Epic production** until NDA + project charter; **FHIR sandbox** first.
- **SOC 2 Type II** as a parallel track, not a blocker for a single forward-thinking pilot.

### 11.5 Repo scaffold (this repository)

The code under `apps/web` is the **distribution-aligned starter**: multi-tenant routing, health/version API, Prisma models, patient statement views.

**All renameable product / company / AI names** live in **`packages/brand`** (`@repo/brand`) — see **`docs/BRANDING.md`**. The web app imports `getBrand()` for titles and IT service id; **do not** scatter marketing strings across file names.

**Epic / EHR test data:** See **`docs/EPIC_AND_TEST_DATA.md`** — use sandboxes and synthetic data, not “open source Epic production data.”

---

*Version 1.4 — **Anang** ([anang.ai](https://anang.ai)); onboarding: `docs/PLATFORM_OVERVIEW.md`. Internal workspace `@platform/web`.*

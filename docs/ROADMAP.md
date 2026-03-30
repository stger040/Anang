# Roadmap (starter → enterprise)

This document translates the scaffold into a credible production path without committing to premature microservices.

## Phase 0 — Pilot ready (current repo)

- [x] Split marketing vs platform apps
- [x] Prisma schema + seed tenants with varied entitlements
- [x] Build module MVP (queue, detail, AI rationales, issues, approval)
- [x] Pay / Connect / Insight MVPs with credible UI
- [x] Super admin + tenant settings shell
- [x] Vercel-oriented deployment notes

## Phase 1 — Real auth & org lifecycle

- Replace demo cookie with SSO (OIDC/SAML) and durable sessions
- Self-service org provisioning + billing (Stripe) mapped to `ModuleEntitlement`
- Invites & JIT membership provisioning
- BAA-aware logging and retention policy documentation

## Phase 2 — Integrations

- EMR / FHIR or vendor SDK for clinical documentation ingestion (Build)
- Clearinghouse + 837/277/835 processing (Connect)
- Patient payment gateway + PMS/PM posting (Pay)
- Data warehouse export for Insight (dbt / Snowflake / BigQuery)

## Phase 3 — AI services

- Model hosting (VPC) for code suggestion + denial risk scoring
- Evaluation harness, offline replay on historical remits
- Human feedback loop captured for model + rules tuning

## Phase 4 — Enterprise hardening

- Row-level security, field-level encryption where required
- Dedicated environments per client (optional) vs shared multi-tenant with strong isolation
- SOC2 Type II controls aligned to customer security questionnaires

## Principles

- **One platform** — modules share identity, navigation, and data contracts.
- **Modular entitlements** — sales can compose SKUs without forked codebases.
- **Solo-founder friendly** — keep the critical path in one TypeScript repo until revenue funds specialization.

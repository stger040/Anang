# Architecture — Anang monorepo

## Deployable apps today vs patient surfaces (vision)

Anang ships as **one product brand**. **Today** the repo has **two** deployable Next.js applications:

| App | Package | Intended host | Audience |
|-----|---------|---------------|----------|
| Public marketing | `@anang/marketing-site` | `anang.ai` | Prospects, investors, health-system buyers |
| Product platform | `@anang/platform-app` | `app.anang.ai` | Authenticated **staff and admins** (tenant workspace `/o/[orgSlug]/…`, super-admin `/admin`) |

**Vision (not separate from the modules—additional shells):** **Patients** should use the **same** Pay / Cover / Support / Core **APIs** on **mobile web (incl. SMS magic links)**, **desktop web**, and eventually **native iOS / Android**—see **`docs/PRODUCT_SURFACES_VISION.md`** and **`docs/PATIENT_SCENARIOS_AND_MOBILE_APP.md`**. That may appear as a **`apps/patient-portal`** app or route group per **`BUILD_PLAN.md`**; it does **not** change the **`ModuleKey`** list in Prisma.

Keeping marketing and **staff** platform **separate** preserves caching, security boundaries, release cadence, and Vercel mapping. A future **patient** app will follow the same pattern (or shared BFF) with **stricter** PHI UX review.

Shared UI, copy, configuration, and TypeScript types live in `packages/*` so all surfaces stay aligned without merging codebases.

## Staff workspace, patient web, and EHR embedding (repo facts)

- **Clinic/staff product shell** is **`/o/[orgSlug]/…`**: authenticated workspace (Build, Pay staff views, Connect, Cover counselor queues, Support agent workspace, etc.). `middleware.ts` sends unauthenticated visitors on `/admin` and `/o` to **`/login`**.
- **Patient-facing billing (web) today** is the **public** route group **`/p/[orgSlug]/…`** in the same `platform-app`: org landing copy + **magic-link** statement pay (`/p/{org}/pay/{token}`), optional DOB/account step-up, Stripe patient checkout — **no** tenant workspace account for the patient path (see `apps/platform-app/src/app/p/` and `apps/platform-app/.env.example` for `PATIENT_PAY_LINK_SECRET`, `DISABLE_PATIENT_PAY_STEPUP`).
- **Greenway / Intergy FHIR** is implemented as **server-to-server** reads/sync (bearer or client-credentials from env, cron + Implementation hub actions). The HTTP client is explicitly **server-side only** (`apps/platform-app/src/lib/connectors/greenway-fhir/client.ts`). There is **no** SMART-on-FHIR launch handler or EHR **iframe** host route in the shipped platform shell — Integration hub is **staff Settings** configuration and probes, not an in-EHR embedded UI.
- **Planning docs** (e.g. `IMPLEMENTATION_PLAN.md`) may describe optional future **embedded** EHR widgets alongside standalone staff use; that is **strategy**, not current code coupling.

**Tenant data isolation:** default is **one Postgres** (`DATABASE_URL`) with **logical** `tenantId` scoping across Prisma models. Optional **`DATABASE_URL__<SLUG>`** overrides for specific org slugs are documented in **`docs/NEON_VERCEL_TENANTS_AND_GREENWAY.md`** and implemented in **`apps/platform-app/src/lib/prisma.ts`** — not automatic “one Neon branch per `/admin` tenant.”

## Platform-app structure

- **`/login`** — Auth.js: optional **OpenID Connect (enterprise SSO)** + staging **Credentials** provider; JWT session cookie (`AUTH_SECRET` required).
- **`/admin`** — **super admin** only (`AppRole.SUPER_ADMIN`). Lists tenants and cross-tenant audit.
- **`/o/[orgSlug]/…`** — tenant-scoped workspace. Access requires membership **unless** the user is a super admin.

Data access uses **Prisma** against **PostgreSQL**. The schema models organizations (`Tenant`), users (`User`), memberships (`Membership`), purchased modules (`ModuleEntitlement`), revenue-cycle entities (patients, encounters, drafts, claims, statements), and `AuditEvent` rows for a future compliance story.

### Why Next.js for the “backend” (for now)

API routes (`/api/auth/*`) and Server Actions cover auth + mutations without a separate Nest service. This keeps operational surface area small for a solo founder. The service layer is **not** locked to Next: Prisma and domain logic can move behind a dedicated API on AWS/Azure later; clients would switch from direct server calls to HTTP without rethinking the domain model.

### Build-time and runtime

`apps/platform-app` sets `export const dynamic = "force-dynamic"` on the root `layout.tsx` so routes are not statically prerendered with Prisma at build time (CI does not need `DATABASE_URL` to compile).

## Module model (product)

The product is **one platform, many modules** (Build, Pay, Connect, Insight, Support, Cover, plus Core admin). Navigation and route-level layouts **gate** features using `ModuleEntitlement` rows. Disabled modules return **404** at module routes so URLs do not expose unlicensed product areas.

**Staff data (examples):** `CoverAssistanceCase` powers **Cover** intake queues; `SupportTask` powers **Support** work queues — both tenant-scoped in Postgres (see `prisma/schema.prisma`).

**Cross-module staff navigation (demo / pilot clarity):** when `Claim` and `Statement` rows carry optional links to **`Encounter`** and **`ClaimDraft`** (see migration `20260502100000_link_claim_draft_encounter_statement` and `docs/TENANCY_AND_MODULES.md`), the **encounter**, **claim timeline**, and **statement detail** routes in `platform-app` surface compact **Build ↔ Connect ↔ Pay** buttons so operators can follow one patient thread without copying IDs manually.

## AI / Build

Today, ICD/CPT suggestions, denial risk, and documentation gaps are **seeded and deterministic** but shaped like future pipeline outputs: each suggestion includes human-readable “why” text.

**Target architecture (not LLM-first)** — see **`IMPLEMENTATION_PLAN.md`** (strategic section) and **`docs/MEDICAL_AI_AND_EXPLANATION_LAYER.md`**:

1. **Deterministic rules engine** — validation, payer edits, normalization; **runs with external LLMs disabled**.
2. **Retrieval / knowledge** — code references, bulletins, SOPs — **grounding**, not raw generation.
3. **Narrow predictive scores** — when instrumentation supports them (shadow → promote).
4. **Generative explanation** — paraphrase for staff/patient UX; **provider-swappable** (template fallback required).

**Connectors** feed the canonical model; see **`docs/CONNECTOR_STRATEGY.md`** and **`docs/CORE_DATA_MODEL.md`**.

**Persistence direction:** `ClaimDraft`, `ClaimDraftLine`, `ClaimIssue` evolve toward **rule-id / citation-linked** audit; add **recommendation + outcome** tables as Build matures.

## White-label

`Tenant` carries `primaryColor`, `logoUrl`, and `displayName`. The marketing site reads brand defaults from `@anang/brand` with optional env overrides; the platform can extend tenant theming by threading CSS variables from settings (not fully wired in this starter).

## Mock vs production-ready

| Area | Mock / scaffold | Production-oriented pieces |
|------|-------------|---------------------------|
| Auth | HTTP-only cookie with JSON payload | Replace with SSO + server sessions |
| AI | Static rationale strings in DB | Swap service implementation |
| EDI / clearinghouse | Placeholder copy + timelines | Integrate vendor + parsers |
| Audit | Single-table events | Stream to SIEM + retention policy |

See also: `docs/TENANCY_AND_MODULES.md`, `docs/MODULES_CUSTOMER.md`, `docs/DEPLOYMENT.md`, `docs/PRODUCT_SURFACES_VISION.md`.

*Last updated: 2026-04-19 — staff cross-module navigation when Claim/Statement FKs are set.*

# Session handoff — Anang / Medtech_placeholder

**Purpose:** Give a **new Cursor chat** (or a new teammate) enough context to work without replaying prior threads. Update this file when major direction or repo facts change.

---

## Quick start — paste into your first new-chat message

Copy everything inside the fence below (then replace the last line with your goal).

```markdown
Read `docs/SESSION_HANDOFF.md` in this repo, then help me with:

**My immediate goal:** [describe what you want in this session]
```

---

## Workspace & product

| Item | Detail |
|------|--------|
| **Product** | **Anang** — multi-tenant U.S. healthcare revenue-cycle platform (Next.js monorepo). |
| **Apps** | `apps/marketing-site` (public), `apps/platform-app` — staff workspace `/o/[orgSlug]`, patient billing `/p/...`, super-admin `/admin`. |
| **Data** | **Prisma** + **PostgreSQL** (`DATABASE_URL`). Tenant isolation via `tenantId` (+ optional `DATABASE_URL__<SLUG>` — see `docs/NEON_VERCEL_TENANTS_AND_GREENWAY.md`). |

**Local path note:** The repo may live under `C:\Users\stger\Dev\Enterprises\Medtech_placeholder` (spelling **Enterprises**). GitHub, Vercel, and Neon **do not** depend on that parent folder name.

---

## Recent engineering context (assume present unless reverted)

### 1. Connected synthetic seed (one patient lifecycle)

**File:** `apps/platform-app/prisma/seed.ts`

- **One primary patient (Sam)** on tenant slug **`synthetic-test`** drives: **Encounter → ClaimDraft (Build) → Claim (Connect)** with explicit links **→ Statement (Pay)** with explicit links **→ SupportTask + CoverAssistanceCase** on the **same** patient.
- **Removed** the second demo patient and orphan Cover row that broke the story.
- **Numbers aligned** for demo: e.g. professional charge, insurance paid portion, patient responsibility on the statement; timeline labels: draft approved → 837 → 277CA → 835 → insurance payment.

### 2. Minimal schema links (demo / pilot clarity)

**Migration:** `apps/platform-app/prisma/migrations/20260502100000_link_claim_draft_encounter_statement/migration.sql`

Optional FKs (nullable, no forced platform redesign):

- `Claim.encounterId` → `Encounter`
- `Claim.claimDraftId` → `ClaimDraft` (1:1, unique)
- `Statement.claimId` → `Claim`

**After clone / new machine:** from `apps/platform-app`, run `npx prisma migrate deploy`, then `npm run db:seed -w @anang/platform-app`. If Prisma **`P1000`**, fix **Neon credentials** in `.env` — not application code.

### 3. Doc touch-ups

- `docs/TENANCY_AND_MODULES.md` — connected seed **and** staff module/data thread (Build → Connect → Pay → Support; Cover patient-scoped).
- `docs/CLIENT_SHOWCASE.md` — LCO walkthrough order + cross-link capability row.
- `docs/PLATFORM_OVERVIEW.md`, `docs/ARCHITECTURE.md`, `docs/CORE_DATA_MODEL.md`, `docs/MODULES_CUSTOMER.md` — repo-aligned seed reality (`synthetic-test` only), optional FKs, staff UI navigation.
- Example Windows `cd` paths in `docs/IMPORT_SYNTHETIC_DATASETS.md`, `docs/FOUNDER_BUILD_GUIDE.md` — use **`Enterprises`** in the path string for consistency with the preferred folder name.

---

## Business / pilot context (high level)

- **First-client / demo narrative:** staff-first operational value (**Build, Pay, Connect, Support**, **Settings → Implementation hub**). Avoid overselling a **native patient app**; patient path today is mainly **tokenized `/p/...` Pay** + roadmap in `docs/PRODUCT_SURFACES_VISION.md`.
- **EHR:** **Greenway / Intergy FHIR** is a **server-side** connector + hub tooling — not an in-EHR embedded shell. Pilot sequencing: `docs/PILOT_CONNECTOR_ROADMAP.md`, `docs/CONNECTOR_STRATEGY.md`.

---

## Trust docs (read before PHI or go-live)

- `docs/DEPLOYMENT.md` — Vercel, env vars, Stripe, inference / HIPAA toggles.
- `docs/DEVELOPMENT_NEEDS.md` — BAAs, Stripe, SMS, what unlocks the next layer.
- `docs/NEON_VERCEL_TENANTS_AND_GREENWAY.md` — one DB vs optional per-slug URL; Neon branches vs app tenants.

---

## How to work with the agent (owner preferences)

- Stay **grounded in repo + docs**; say what is **built vs planned**.
- Prefer **small, focused diffs** unless the task clearly needs a larger change.
- **PowerShell:** use `;` between commands where `&&` is unreliable.
- Compliance / BAAs / PCI: **flag** and document; legal decisions stay with the human.

---

## Maintenance

When you finish a meaningful arc, add a **one-line “Last updated”** note here with date + topic (e.g. “2026-04-19 — connected seed + Claim/Statement FKs”).

---

*Last updated: 2026-04-19 — staff UI cross-links (Build ↔ Connect ↔ Pay); docs aligned (`PLATFORM_OVERVIEW`, `TENANCY_AND_MODULES`, `CLIENT_SHOWCASE`, `ARCHITECTURE`, `CORE_DATA_MODEL`, `MODULES_CUSTOMER`); connected synthetic seed + Claim/Statement FK migration.*

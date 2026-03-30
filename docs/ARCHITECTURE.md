# Architecture — Anang monorepo

## Two surfaces, one company

Anang ships as **one product brand** with **two deployable Next.js applications**:

| App | Package | Intended host | Audience |
|-----|---------|---------------|----------|
| Public marketing | `@anang/marketing-site` | `anang.ai` | Prospects, investors, health-system buyers |
| Product platform | `@anang/platform-app` | `app.anang.ai` | Authenticated staff and admins |

Keeping them **separate apps** preserves clean caching, security boundaries (no accidental export of marketing bundles into authenticated areas), independent release cadence, and straightforward Vercel project mapping.

Shared UI, copy, configuration, and TypeScript types live in `packages/*` so both surfaces stay visually and semantically aligned without merging codebases.

## Platform-app structure

- **`/login`** — demo cookie auth (replace with enterprise IdP before production).
- **`/admin`** — **super admin** only (`AppRole.SUPER_ADMIN`). Lists tenants and cross-tenant audit.
- **`/o/[orgSlug]/…`** — tenant-scoped workspace. Access requires membership **unless** the user is a super admin.

Data access uses **Prisma** against **PostgreSQL**. The schema models organizations (`Tenant`), users (`User`), memberships (`Membership`), purchased modules (`ModuleEntitlement`), revenue-cycle entities (patients, encounters, drafts, claims, statements), and `AuditEvent` rows for a future compliance story.

### Why Next.js for the “backend” (for now)

API routes (`/api/auth/*`) and Server Actions cover auth + mutations without a separate Nest service. This keeps operational surface area small for a solo founder. The service layer is **not** locked to Next: Prisma and domain logic can move behind a dedicated API on AWS/Azure later; clients would switch from direct server calls to HTTP without rethinking the domain model.

### Build-time and runtime

`apps/platform-app` sets `export const dynamic = "force-dynamic"` on the root `layout.tsx` so routes are not statically prerendered with Prisma at build time (CI does not need `DATABASE_URL` to compile).

## Module model (product)

The product is **one platform, many modules** (Build, Pay, Connect, Insight, Support, Cover, plus Core admin). Navigation and route-level layouts **gate** features using `ModuleEntitlement` rows. Disabled modules return **404** at module routes so URLs do not leak unlicensed product areas in demos.

## AI / Build

Today, ICD/CPT suggestions, denial risk, and documentation gaps are **seeded and deterministic** but shaped like future model outputs: each suggestion includes human-readable “why” text. The intended production split is:

1. **UI** — human-in-the-loop review and approval.
2. **Service layer** (future) — model inference, rules, payer policy graph, evidence retrieval.
3. **Persistence** — `ClaimDraft`, `ClaimDraftLine`, `ClaimIssue` mirror what a real pipeline would store.

## White-label

`Tenant` carries `primaryColor`, `logoUrl`, and `displayName`. The marketing site reads brand defaults from `@anang/brand` with optional env overrides; the platform can extend tenant theming by threading CSS variables from settings (not fully wired in this starter).

## Mock vs production-ready

| Area | Mock / demo | Production-oriented pieces |
|------|-------------|---------------------------|
| Auth | HTTP-only cookie with JSON payload | Replace with SSO + server sessions |
| AI | Static rationale strings in DB | Swap service implementation |
| EDI / clearinghouse | Placeholder copy + timelines | Integrate vendor + parsers |
| Audit | Single-table events | Stream to SIEM + retention policy |

See also: `docs/TENANCY_AND_MODULES.md`, `docs/DEPLOYMENT.md`.

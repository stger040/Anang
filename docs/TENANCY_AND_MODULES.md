# Tenancy & modules

## Tenants

Each **client organization** is a `Tenant` row:

- **Identity** — `slug` (URL key), `name`, `displayName`.
- **White-label** — `primaryColor`, `logoUrl` (optional).
- **Flex settings** — JSON `settings` for timezone, feature knobs, integration flags.

All operational data (patients, encounters, claims, statements, etc.) includes `tenantId` and is queried **through** that foreign key for isolation.

## Users & memberships

`User` is global (one email across the platform). `Membership` connects a user to a **single tenant** with a **tenant-scoped role** (`TENANT_ADMIN`, `STAFF`). The global `User.appRole` can mark a **super admin** (`SUPER_ADMIN`) who may open any `/o/[orgSlug]` without a membership row (support / repair; primary provisioning UI remains **`/admin`**).

**Role boundaries (patient vs staff vs tenant admin vs super-admin), module vs user access, and API expectations** are formalized in **[`ACCESS_MODEL.md`](./ACCESS_MODEL.md)**. v1 enforces **tenant-admin-only** access to **`/o/.../settings/**`** (org admin, users, audit, entitlements UI); **staff** see operational modules only for entitlements that are on, not the Admin shell.

## Authentication policy (per tenant)

Tenant staff should use **`/login?org={slug}`** so password vs SSO options match that organization’s settings.

Super admins edit **`Tenant.settings.auth`** (v1) via **`/admin`** → tenant → **Authentication & SSO**:

| Policy | Meaning |
|--------|---------|
| `local_only` | Password (and internal virtual mailbox flow) only; no SSO tiles for that org. |
| `sso_allowed` | Password **and** SSO when configured (recommended during rollout). |
| `sso_required` | Password sign-in **blocked** when credentials include that org; users must use SSO. |

**SSO** can be a **dedicated OIDC app** per tenant (issuer + client ID in DB; **client secret in env** `AUTH_OIDC_CLIENT_SECRET__…`) and/or optional **platform-wide** OIDC (`AUTH_OIDC_*`). Neither is required globally. Client IT steps: **[`CLIENT_IT_OIDC_ONBOARDING.md`](./CLIENT_IT_OIDC_ONBOARDING.md)**.

**Email matching:** OIDC sign-in resolves users by **email** from the IdP token against `User.email`. **Optional JIT** (tenant OIDC only): super admin can allow automatic `User` / `Membership` creation on first SSO — see **[`CLIENT_IT_OIDC_ONBOARDING.md`](./CLIENT_IT_OIDC_ONBOARDING.md)** §3. Platform-wide `AUTH_OIDC_*` login still requires a pre-existing user.

**Adding a new health-system client**

1. **Super admin UI:** `/admin` → **New tenant** — creates `Tenant` + all `ModuleEntitlement` rows (`CORE` always on; optional modules toggled). Then open **Manage** on that tenant to add `User` + `Membership` rows, or **Create invite link** (`UserInvite` row + `/invite/[token]`) so the invitee signs in and receives membership automatically.
2. **Alternate:** Prisma Studio / script against the same tables if you prefer.
3. **Invites** are time-limited, one-time links (hashed token in DB); **JIT** on tenant OIDC can still create users when enabled — use whichever fits IT policy.

## Module entitlements

`ModuleEntitlement` is unique on `(tenantId, module)` with boolean `enabled`.

**Customer-facing names** (Cedar-aligned story + Build / Connect / Insight): see **[`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md)**.

| Module key | Product area |
|------------|----------------|
| `CORE` | Platform “always on” for navigation baseline; **org admin screens** under `/settings` require **tenant admin** (or super-admin), not every staff member |
| `BUILD` | Claims build / AI assistance / HITL approvals |
| `PAY` | Statements, balances, payments |
| `CONNECT` | Claim lifecycle, timelines, remittance, **Authorizations** (prior auth case tracking — medical benefit Phase 1) |
| `INSIGHT` | KPI dashboards |
| `SUPPORT` | Staff operations workspace — **MVP/scaffold UI** today; target **Support** in [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) |
| `COVER` | Affordability / coverage — **MVP/scaffold UI** today; target **Cover** in [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) |

Route groups under `/o/[orgSlug]/*/layout.tsx` call **`requireModuleForSession`**, which **404s** if the module is off **for the tenant** or **disallowed for this staff user** (`staffModuleAllowList`). Navigation passes **`effectiveModules`** into the shell so the sidebar matches both **entitlements** and **per-staff caps**.

## Staff journey & data thread (how modules chain)

**Intended operational story (one patient / one visit):** staff work moves from **clinical visit → pre-claim build → payer submission & adjudication → patient balance → follow-up**. In the data model that maps cleanly when these links exist:

| Step | Module (staff UI) | Canonical rows |
|------|---------------------|------------------|
| 1 | **Build** | `Patient` → `Encounter` → `ClaimDraft` (+ `ClaimDraftLine`, `ClaimIssue`) — includes **prior_auth** category issues when heuristics hit |
| 1b | **Connect → Authorizations** (optional, same episode) | `PriorAuthCase` (+ checklist, services, events); optional links to same `Encounter` / `Claim` / `Coverage` |
| 2 | **Connect** | `Claim` (+ `ClaimTimelineEvent`, remittance-related rows as you enrich data) |
| 3 | **Pay** | `Statement` (+ `StatementLine`), optional `Payment` / plans |
| 4 | **Support** | `SupportTask` (typically `statementId` + `patientId` for billing follow-ups) |
| 5 | **Cover** | `CoverAssistanceCase` (**patient-scoped** today; no required FK to statement/claim) |

**Optional FKs (Prisma / Postgres)** tie the thread for demos and pilots without forcing every legacy row to backfill:

- `Claim.encounterId` → `Encounter`; `Claim.claimDraftId` → `ClaimDraft` (1:1 when set).
- `Statement.claimId` → `Claim`; `Statement.encounterId` → `Encounter`.

**Staff UI:** when those FKs are set, the platform surfaces **explicit navigation** between modules on the encounter detail, claim timeline, and statement detail pages (Build ↔ Connect ↔ Pay). **Connect → Authorizations** (`/o/[orgSlug]/connect/authorizations`) is the **prior auth workqueue**; **Build → encounter** can **create a prefilled PA case** when Connect + Build are entitled. Support and Cover queues remain **separate shells** but read the same tenant data; Support especially benefits when tasks reference **`statementId`**. Product/sales framing: **[`PRIOR_AUTHORIZATION.md`](./PRIOR_AUTHORIZATION.md)**.

**Synthetic seed** (`apps/platform-app/prisma/seed.ts`, tenant **`synthetic-test`**) populates the full chain above for **Sam TestPatient**, including timeline labels that narrate draft approval → 837 → 277CA → 835 → insurance payment → patient responsibility.

### Dental vertical (module story)

**Dental** is a **Cedar Orthodontics–class vertical**: same **`ModuleKey`** set (Build, Pay, Connect, …), with **dental-specific** product packaging — CDT/treatment-plan/installment/guarantor semantics and DMS/PMS integration expectations — see **`docs/MODULES_CUSTOMER.md`** § *Dental vertical*.

**Today:** express dental deals with **`Tenant.settings`** (feature flags / `implementation.ehrVendor`) and copy/flows tuned for dental tenants; **no** `DENTAL` row in `ModuleEntitlement` yet.

**Future (optional):** add **`DENTAL`** to `ModuleKey` when you need a **hard entitlement** line in contracts and navigation (e.g. show a **Dental** hub or gate dental-only routes). Until then, dental is a **go-to-market + config** layer on the existing keys.

**No change to core module keys required** for MVP dental pilots — only add `DENTAL` when product/legal wants an explicit SKU bit in the database.

## Pilot / seed tenants

| Slug | Story |
|------|--------|
| `synthetic-test` | **Synthetic-test** — single seeded org; **all modules** enabled; seed uses **one patient (Sam)** for a **connected demo**: Encounter → approved **ClaimDraft** → **Claim** (FKs to encounter + draft) → **Statement** (FKs to encounter + claim) → **SupportTask** (same statement + patient) + **CoverAssistanceCase** (same patient; narrative tie to statement in notes) → **four `PriorAuthCase` rows** (draft, in review, approved with auth # + expiration, denied) for **Connect Authorizations** demos (`prisma/seed.ts`). Staff UI cross-links on Build / Connect / Pay detail pages match this thread when you click through. |

**Product sign-in (`/login`)** uses **email + password** (and optional SSO). **Virtual mailbox** (optional): when the email matches `PLATFORM_VIRTUAL_EMAIL` / `NEXT_PUBLIC_PLATFORM_VIRTUAL_EMAIL` (default **`support@anang.ai`**) and the user enters `PLATFORM_LOGIN_PASSWORD`, the server maps to a real `User` via `login-routing.ts` (default profile → super admin in current seed). Prefer **real addresses** registered in the database.

- Password: `PLATFORM_LOGIN_PASSWORD` (legacy: `DEMO_LOGIN_PASSWORD`). **Change the default** in any shared or production-adjacent deploy.

**Current seed operator emails** (`prisma/seed.ts`):

- **`rick@anang.ai`** — `User.appRole` **SUPER_ADMIN**; **membership** as **tenant admin** on `synthetic-test`
- **`rick@stginnovation.com`** — **STAFF** on `synthetic-test`

**Patient (not a staff `User`):** e.g. **`stger040@gmail.com`** on **`Patient.email`** for **`Sam TestPatient`** — use Pay / portal links, not `/login`.

## Patient portal identity (vs staff `User`)

**Staff** use global **`User`** + **`Membership`**. **Patients** on **`/p/*`** use magic-link tokens and a gate cookie; **`PatientPortalIdentity`** (1:1 with **`Patient`**) is created/updated on successful **`patient-verify`** so the data model explicitly separates billing-portal actors from RCM staff. It is **not** a duplicate login system yet — it is the persistence hook for future durable patient auth.

## Data isolation posture

- **Application-level** isolation via `tenantId` predicates (common for healthcare SaaS at early stage).
- **Future** hardening: row-level security in Postgres, per-tenant encryption keys, VPC peering for integrations — none of that replaces correct query discipline; it augments it.

## Audit

`AuditEvent` stores actor, action, resource, optional tenant scope, and JSON metadata. Super admins can read a **global** feed (`/admin/audit`); tenant admins see **tenant** events under settings.

*Last updated: 2026-04-24 — Connect **Authorizations** / `PriorAuthCase` in staff journey + synthetic seed PA cases; `PRIOR_AUTHORIZATION.md`.*

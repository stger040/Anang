# Tenancy & modules

## Tenants

Each **client organization** is a `Tenant` row:

- **Identity** — `slug` (URL key), `name`, `displayName`.
- **White-label** — `primaryColor`, `logoUrl` (optional).
- **Flex settings** — JSON `settings` for timezone, feature knobs, integration flags.

All operational data (patients, encounters, claims, statements, etc.) includes `tenantId` and is queried **through** that foreign key for isolation.

## Users & memberships

`User` is global (one email across the platform). `Membership` connects a user to a **single tenant** with a **tenant-scoped role** (`TENANT_ADMIN`, `STAFF`). The global `User.appRole` can mark a **super admin** (`SUPER_ADMIN`) who may open any `/o/[orgSlug]` without a membership row.

**Adding a new health-system client**

1. `INSERT` (or admin UI) `Tenant` with a unique `slug`.
2. Create `ModuleEntitlement` rows per purchased module (`enabled: true`; optional explicit `enabled: false` for clarity).
3. Create `User` + `Membership` for their initial admin(s).
4. Invite flow (email magic link, SSO JIT) replaces demo cookie login later.

## Module entitlements

`ModuleEntitlement` is unique on `(tenantId, module)` with boolean `enabled`.

| Module key | Product area |
|------------|----------------|
| `CORE` | Always-on admin: settings, entitlements display, user list |
| `BUILD` | Claims build / AI assistance / HITL approvals |
| `PAY` | Statements, balances, payments |
| `CONNECT` | Claim lifecycle, timelines, remittance placeholders |
| `INSIGHT` | KPI dashboards |
| `SUPPORT` | Staff operations workspace (scaffold) |
| `COVER` | Affordability / coverage (scaffold) |

Route groups under `/o/[orgSlug]/*/layout.tsx` call `requireModule(orgSlug, "…")` which **404s** if the module is off — this keeps demos honest when a buyer has only purchased a subset.

## Demo tenants (seed)

| Slug | Story |
|------|--------|
| `lco` | **LCO Health Center** — all modules enabled for full-platform pilots |
| `hayward` | **Tamarack Health** (Hayward site) — Build + Pay + Insight + Core (no Connect / Support / Cover) |
| `ashland` | **Tamarack Health** (Ashland site) — same module mix; distinct org slug for multi-site demos |
| `demo` | **Demo Tenant** — Pay + Insight + Core only |

**Product sign-in (`/login`)** uses an email + password form with a **demo tier** picker (no real mailbox needed):

- Default virtual email: `demo@anang.ai` (override with `DEMO_LOGIN_EMAIL` / `NEXT_PUBLIC_DEMO_LOGIN_EMAIL`).
- Default password: `demo` (override with `DEMO_LOGIN_PASSWORD`).
- **Enterprise** tier → signs in as LCO (all modules). **Growth** → Tamarack (subset). **Essentials** → Demo tenant (Pay + Insight). **Platform admin** → super admin (`/admin`).

Power users can still sign in with a seeded email directly (same demo password) — tier selection only applies to the virtual demo email.

Seeded identities behind the tiers:

- `super@anang.internal` — platform super admin
- `admin@lco.anang.demo` — LCO tenant admin
- `rcm@tamarack.anang.demo` — Tamarack staff (seeded memberships on **hayward** and **ashland**; first-login redirect uses `/o/hayward/...` by membership order)
- `viewer@demo.anang.demo` — Demo tenant staff

## Data isolation posture

- **Application-level** isolation via `tenantId` predicates (common for healthcare SaaS at early stage).
- **Future** hardening: row-level security in Postgres, per-tenant encryption keys, VPC peering for integrations — none of that replaces correct query discipline; it augments it.

## Audit

`AuditEvent` stores actor, action, resource, optional tenant scope, and JSON metadata. Super admins can read a **global** feed (`/admin/audit`); tenant admins see **tenant** events under settings.

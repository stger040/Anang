# Neon branches, Vercel, tenants in the app, and Greenway

## Core idea (one Postgres per deployment)

The platform uses **one `DATABASE_URL` per Vercel deployment** (one Prisma client, one physical Postgres). **Tenants** (`Tenant` rows + `tenantId` on patients, encounters, claims, etc.) are **logical** isolation inside that database.

Creating a tenant in **`/admin`** only inserts rows in **whatever database `DATABASE_URL` points to**. It does **not** create a Neon branch, fork, or second database.

## Neon “branches” vs app tenants

| Neon concept | App concept |
|--------------|------------|
| **Branch** (e.g. `main`, `synthetic-testing`) | A **separate Postgres** with its **own connection string**. Whichever string is in **`DATABASE_URL`** is the only DB the app reads/writes in production. |
| **Tenant** (`slug` e.g. `synthetic-test`) | A **row** (and related rows) **inside** that single Postgres. |

The app **cannot** merge two Neon branches in real time in one request. To “see branch A’s data in the app,” **`DATABASE_URL` on Vercel must be branch A’s connection string** (or you copy/restore data into the branch Vercel already uses).

## Why you might see only “Sam TestPatient”

1. **This branch only contains seed-scale data** for `synthetic-test` — that’s expected until you import more or connect Greenway.
2. **Rich data lives on another Neon branch** — if Vercel’s `DATABASE_URL` is not that branch’s URL, the app will never show it.
3. **Data was imported under another tenant slug** — rows are keyed by `tenantId`. If importer used a different tenant than `synthetic-test`, open **`/o/{that-slug}`** or re-import for the right slug.

Use the repo diagnostic:

```bash
cd apps/platform-app
npx tsx prisma/report-tenant-stats.ts
```

With Neon:

```bash
cd apps/platform-app
node --env-file=.env.neon ../../node_modules/tsx/dist/cli.mjs prisma/report-tenant-stats.ts
```

Compare the printed slug row counts with what you see in the Neon SQL editor for the **same** connection string as Vercel.

## “First client” pattern (recommended)

For a real customer you typically **do not** spin a new Neon branch per click in `/admin`. You:

1. **Create a Neon branch or project** for that customer when you’re ready (ops decision: staging vs prod).
2. Set **Vercel `DATABASE_URL`** (and Preview if needed) to that branch’s connection string.
3. Run **`prisma migrate deploy`** against that database (often in the Vercel build, as in `DEPLOYMENT.md`).
4. Create the **`Tenant`** + users in **`/admin`** (or seed) on **that** database.
5. Configure **Greenway** env + **`Tenant.settings`** / **`GREENWAY_FHIR_*__SLUG`** so **sync jobs write into the same Postgres** (`canonical-ingest` / cron). That is your “real time” path from EHR → Neon → UI.

If you later want *many customers on one Vercel app and one Neon database*, you keep a **single `DATABASE_URL`** and many tenant slugs — still no automatic Neon branch per tenant unless you build that as separate infrastructure.

## Optional env: `DATABASE_URL__<SLUG>` (per-tenant branch)

Slug `synthetic-test` maps to **`DATABASE_URL__SYNTHETIC_TEST`** (hyphens → underscores, uppercased). When set, **`/o/synthetic-test`**, **`/p/synthetic-test`**, tenant **OIDC callback**, **credentials login with `?org=`**, **flow-intent**, and **tenant-scoped API routes** (pay, support assistant, clearinghouse inbound X12, Stripe checkout metadata with `orgSlug`) use that connection string. Everything else (**`/admin`**, global NextAuth helpers that only know an email, **`/post-signin`**, cron unless updated) still uses **`DATABASE_URL`**.

That override database must be a **full** Prisma migrate target with **`User`**, **`Membership`**, **`Tenant`**, and all clinical tables for that environment — same IDs you expect in the UI — or auth and FKs will disagree between databases.

**Vercel:** add `DATABASE_URL__SYNTHETIC_TEST` = Neon `synthetic-testing` branch URL (pooler or direct per Neon docs). Redeploy. Log in via **`/login?org=synthetic-test`** (or your tenant SSO path) so the session resolves users/memberships on the branch.

Prefer a **single `DATABASE_URL`** per deployment when you can; use overrides only when you deliberately split a demo tenant onto its own Neon branch.

## Imports and Greenway (more rows in modules)

- **Bulk spreadsheet path:** `npm run db:import:xlsx:neon -w @anang/platform-app` (see `docs/IMPORT_SYNTHETIC_DATASETS.md`, `IMPORT_TENANT_SLUG`).
- **Greenway path:** Implementation hub + `docs/PILOT_CONNECTOR_ROADMAP.md`, cron `GREENWAY_FHIR_CRON_PATIENT_IDS`, etc.

Both write to the **same** Postgres as `DATABASE_URL`.

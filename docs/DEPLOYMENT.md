# Deployment — GitHub, Vercel, and Postgres

## Source control (GitHub)

- **Repository:** push this monorepo as a **single** Git repo (one `package-lock.json`, workspaces at root).
- **Default branch:** use `main`.
- **Do not commit:** `.env*`, `node_modules/`, `**/.next/`, secrets, or local databases. Root **`.gitignore`** covers these; only `**/.env.example` templates belong in git.

### First push (summary)

1. Create an empty GitHub repository (e.g. `Anang`). You may omit “Add README” if this repo already has one locally.
2. On your machine: `git init` (if needed), `git add`, `git commit`, add `origin`, `git push -u origin main`.
3. See **README.md** for local setup; confirm `npm run build` passes before pushing.

Exact PowerShell commands for initialize + push are in the README or your onboarding checklist from the team.

---

## Vercel (two projects, one GitHub repo)

Vercel will build **two separate projects** from the **same** GitHub repository:

| Vercel project | Root Directory setting | Production domain (intent) |
|----------------|------------------------|----------------------------|
| Anang Marketing | `apps/marketing-site` | `anang.ai` |
| Anang Platform | `apps/platform-app` | `app.anang.ai` |

### Why install from the monorepo root?

Both apps depend on `packages/*` (`@anang/brand`, `@anang/ui`, etc.). npm workspaces resolve those links when `npm install` runs from the **repository root**. If Vercel’s working directory is only `apps/marketing-site`, workspace packages will not link unless you override install.

### Recommended Vercel settings (each project)

In **Vercel → Project → Settings → General**:

1. **Root Directory:** `apps/marketing-site` *or* `apps/platform-app` (per project).
2. **Install Command** (override):

```bash
cd ../.. && npm ci
```

3. **Build Command** (override):

For **marketing**:

```bash
cd ../.. && npm run build -w @anang/marketing-site
```

For **platform** (run migrations first so preview/prod schemas stay current):

```bash
cd ../.. && npm run db:migrate:deploy -w @anang/platform-app && npm run build -w @anang/platform-app
```

4. **Output Directory:** leave default for Next.js (`.next`); Vercel’s Next preset handles it when Framework Preset is **Next.js**.

If your Vercel UI uses “project root” differently, the rule is: **run `npm ci` / `npm install` from the repo root**, then **run the workspace-specific build** with `-w @anang/...`.

Connect each Vercel project to the **same GitHub repo** and branch (usually `main`).

### Where to set Install / Build commands in the Vercel UI

These are **Step 1 (items 3–6)** if you only connected the repo and Root Directory first:

1. Open the project → **Settings** (gear) → **General**.
2. Scroll to **Build & Development Settings**.
3. **Framework Preset:** Next.js (usually auto-detected).
4. **Root Directory:** should already show `apps/marketing-site` or `apps/platform-app`.
5. Enable **Override** next to **Install Command** and paste:
   `cd ../.. && npm ci`
6. Enable **Override** next to **Build Command** and paste the marketing or platform command from the table above.
7. Click **Save**.
8. **Deploy** tab → **Redeploy** (or push a commit) so the new settings run.

`npm ci` needs the repo root `package-lock.json`; the `cd ../..` steps up from `apps/<app>` to the monorepo root.

---

## Environment variables

### Marketing (`apps/marketing-site`)

Optional overrides for `@anang/brand` (see `packages/brand`):

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_ANANG_COMPANY_DISPLAY` | Display name override |
| `NEXT_PUBLIC_ANANG_DOMAIN` | Marketing hostname (e.g. `anang.ai`) |
| `NEXT_PUBLIC_ANANG_APP_HOST` | App hostname for CTAs (e.g. `app.anang.ai`) |
| `NEXT_PUBLIC_ANANG_SUITE_NAME` | Product name in metadata |
| `NEXT_PUBLIC_ANANG_TAGLINE` | Tagline |
| `NEXT_PUBLIC_ANANG_CALENDLY` | Full URL for “Book a demo / Book a call” (e.g. `https://calendly.com/...`) |

Set these in **Vercel → Project → Environment Variables** (or **Settings → Environment Variables**) for Production / Preview as needed. Locally, copy from `apps/marketing-site/.env.example`.

### Platform (`apps/platform-app`)

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string (managed DB recommended) |

**Auth.js (sessions + optional SSO)** — required for any environment users sign into.

| Variable | Required in prod | Purpose |
|----------|------------------|---------|
| `AUTH_SECRET` | **Yes** | HMAC secret for JWT session cookies (e.g. `openssl rand -base64 32`) |
| `AUTH_URL` | Recommended | Canonical app URL (`https://app.anang.ai` on Vercel) — stabilizes OAuth redirects |

**OpenID Connect (enterprise SSO)** — optional; when all issuer/id/secret are set, `/login` shows **Continue with SSO**. Register redirect **`{AUTH_URL}/api/auth/callback/oidc`** with the IdP.

| Variable | Purpose |
|----------|---------|
| `AUTH_OIDC_ISSUER` | Issuer URL (e.g. Microsoft Entra: `https://login.microsoftonline.com/{tenant}/v2.0`) |
| `AUTH_OIDC_ID` | OAuth client id |
| `AUTH_OIDC_SECRET` | OAuth client secret |
| `AUTH_OIDC_NAME` | Button label (optional; default “Enterprise SSO”) |

User must **already exist** in `User` (email match) with appropriate `Membership`; IdP login does not auto-provision.

**Per-tenant OIDC (dedicated client per customer)** — optional; does **not** require global SSO. Configure in **`/admin`** → tenant → **Authentication & SSO** (`Tenant.settings.auth` v1: `policy`, optional `oidc.issuer` + `oidc.clientId`). Client secret **only** via env:

| Variable | Purpose |
|----------|---------|
| `AUTH_OIDC_CLIENT_SECRET__{SLUG}` | Secret for that tenant’s OIDC app. `{SLUG}` is the tenant slug in uppercase; non-alphanumeric characters become `_` (exact key is shown in admin UI). |

Register redirect **`{AUTH_URL}/api/auth/tenant-oidc/{tenantSlug}/callback`** with the customer IdP. Full IT checklist: **`docs/CLIENT_IT_OIDC_ONBOARDING.md`**.

**Organization-scoped login URL:** `{AUTH_URL}/login?org={tenantSlug}` so the correct policy and SSO buttons apply.

**Staging password** (pilots / dev without an IdP): set strong values in shared environments; do not rely on code defaults.

| Variable | Purpose |
|----------|---------|
| `PLATFORM_LOGIN_PASSWORD` | Shared password for seeded operator accounts and virtual-mailbox sign-in |
| `PLATFORM_VIRTUAL_EMAIL` | Virtual mailbox address for the `/login` access-profile picker (server) |
| `NEXT_PUBLIC_PLATFORM_VIRTUAL_EMAIL` | Same email, exposed to the client bundle — must match `PLATFORM_VIRTUAL_EMAIL` when using the picker |

Legacy `DEMO_LOGIN_PASSWORD`, `DEMO_LOGIN_EMAIL`, and `NEXT_PUBLIC_DEMO_LOGIN_EMAIL` are still read if the `PLATFORM_*` names are unset.

**Transactional email (optional — `/admin` → Create invite link)** — if neither provider key is set, the UI still shows the invite URL for manual copy.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | [Resend](https://resend.com) API key (preferred). Invite links use `AUTH_URL` / app origin. |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Invites <invites@yourdomain.com>`. If unset, uses Resend’s `onboarding@resend.dev` (sandbox rules apply). |
| `SENDGRID_API_KEY` | SendGrid API key — used only when `RESEND_API_KEY` is not set. |
| `SENDGRID_FROM_EMAIL` | Verified **From** address for SendGrid (required for real delivery). |

Pre-client **Vercel + optional `noreply@` / `invites@` reminder:** [`PRE_CLIENT_VERCEL_AND_EMAIL_REMINDER.md`](./PRE_CLIENT_VERCEL_AND_EMAIL_REMINDER.md).

**Structured logs (Pay / Stripe, PHI-safe):** [`PLATFORM_LOGGING.md`](./PLATFORM_LOGGING.md).

Optional integrations:

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe **secret** key (`sk_test_…` or live) — enables Pay **Checkout** |
| `STRIPE_WEBHOOK_SECRET` | Signing secret from Stripe Dashboard for `POST /api/webhooks/stripe` |
| `NEXT_PUBLIC_APP_ORIGIN` | Public app base URL for Checkout success/cancel (e.g. `https://app.anang.ai`); else `VERCEL_URL` / localhost |
| `ANANG_PAYMENTS_LIVE` | Set `1` when using live Stripe keys (integration status “live” lane) |
| `PATIENT_PAY_LINK_SECRET` | Optional HMAC secret for **Patient Pay** magic links (`/p/{orgSlug}/pay/...`). If unset, **`AUTH_SECRET`** is used so links still work when auth is configured |
| `DISABLE_PATIENT_PAY_STEPUP` | If `1` / `true` / `yes`, **skips** patient identity confirmation (DOB / account last four) and gate cookie — **demos only**; do not enable with real PHI |

Staff mint links from Pay → statement detail → **Create patient link** or **Email link** (uses **`RESEND_API_KEY`** or **`SENDGRID_API_KEY`** when set; otherwise API returns `delivery: skipped` and you copy the URL manually). Patients need **no workspace login**; after step-up they see balances and line items; Stripe webhook and metadata (`tenantId`, `statementId`) are unchanged from staff checkout.

**Medical AI — statement line explain (optional)**  
Pay → statement detail → **Explain charge** may call a **Chat Completions** HTTP API: **consumer OpenAI** (`api.openai.com`) when **`OPENAI_API_KEY`** is set, or **Azure OpenAI** when **`BILL_EXPLAIN_LLM_PROVIDER=azure`** (or **auto** with all `AZURE_OPENAI_*` vars set), unless explain is disabled.

**HIPAA / PHI — read this before production**

- Statement **line descriptions** can include **identifiers, diagnoses, procedures, or other PHI-adjacent text** from your billing system. Sending that text to a **consumer** OpenAI endpoint is usually **not** acceptable for HIPAA-covered workloads unless you have a **compliant** vendor relationship (often **not** the same as “we have an API key”).
- **Safer defaults for real patient data:**
  1. Set **`OPENAI_DISABLE_BILL_EXPLAIN=1`** — **template-only** explanations (nothing sent to OpenAI).
  2. Or set **`OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD=1`** — only **billing code + amount** are sent; **description text is omitted** (still review with counsel: codes + amounts can be sensitive in aggregate).
  3. For many enterprises, route inference through **Azure OpenAI** in your cloud with a **BAA** — set **`BILL_EXPLAIN_LLM_PROVIDER=azure`** and **`AZURE_OPENAI_ENDPOINT`** / **`AZURE_OPENAI_API_KEY`** / **`AZURE_OPENAI_DEPLOYMENT`** (see table).
- Logs: **`pay.line_explain.completed`** uses IDs + `source` (`openai`, `azure_openai`, or `template`) only — no line text in logs.

| Variable | Purpose |
|----------|---------|
| `BILL_EXPLAIN_LLM_PROVIDER` | Optional: **`openai`** (default if Azure auto is not satisfied), **`azure`**, or omit for **auto** (Azure when all three `AZURE_OPENAI_*` core vars are set) |
| `OPENAI_API_KEY` | Enables **consumer OpenAI** explanations on **`POST /api/pay/explain-line`** when this provider is selected and explain is not disabled |
| `OPENAI_CHAT_MODEL` | Optional (default **`gpt-4o-mini`**) |
| `AZURE_OPENAI_ENDPOINT` | Resource URL, e.g. `https://YOUR_RESOURCE.openai.azure.com` (no trailing slash required) |
| `AZURE_OPENAI_API_KEY` | Azure inference **api-key** |
| `AZURE_OPENAI_DEPLOYMENT` | Chat **deployment name** (maps request to your model) |
| `AZURE_OPENAI_API_VERSION` | Optional API version query param (default **`2024-08-01-preview`**) |
| `OPENAI_DISABLE_BILL_EXPLAIN` | `1` / `true` / `yes` — **never** call a remote LLM; always template |
| `OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD` | `1` / `true` / `yes` — send **code + amount only** to the model (omit description) |
| `INFERENCE_HIPAA_STRICT` | `1` / `true` / `yes` — forces **minimal** bill-line payloads (same effect as `OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD`); enables identifier **redaction** on Support assistant LLM turns; with consumer OpenAI, the app logs a one-time **`pay.bill_explain.hipaa_openai_compliance_reminder`** — confirm **BAA** / data handling with counsel before real PHI |
| `SUPPORT_ASSISTANT_LLM_ENABLED` | `1` / `true` / `yes` — use OpenAI Chat Completions for **Support hub** replies (same **`OPENAI_API_KEY`**); still runs escalation heuristic first; falls back to **template** on errors |
| `SUPPORT_ASSISTANT_OPENAI_MODEL` | Optional override for Support assistant (defaults to **`OPENAI_CHAT_MODEL`** or **`gpt-4o-mini`**) |
| `PLATFORM_LOG_WEBHOOK_URL` | Optional **HTTPS** endpoint; each **`platformLog`** line is **POST**ed as JSON (duplicate of stdout/stderr) for your log stack / SIEM |
| `PLATFORM_LOG_WEBHOOK_SECRET` | Optional; when set, sent as **`Authorization: Bearer …`** on webhook POSTs |

**Operational alerts — clearinghouse / EDI:** On **`POST /api/webhooks/clearinghouse`**, an **`error`**-level **`connect.edi.inbound_webhook.apply_degraded`** log emits when structural validation reports issues or apply was skipped due to strict validation; **`connect.edi.inbound_webhook.transaction_failed`** when the ingest transaction throws. Point alerts at these event names in your drain.

**Transactional SMS — compliance knobs:** Patient **billing SMS** requires **`Patient.billingSmsOptInAt`** (opt-out honored). Optional per-tenant JSON on **`Tenant.settings.messaging`**: **`smsQuietHours`** (`startHour`, `endHour` 0–23, optional **`timezone`** IANA) and **`twilio`** (`accountSid`, `authToken`) for a **subaccount** instead of global `TWILIO_*` env — prefer a secrets vault over long-lived tokens in DB for production.

**PWA (`/p/*`):** **`/patient-manifest.json`** references **`/patient-billing-icon-192.png`** and **`/patient-billing-icon-512.png`**. **Web Push** is gated by **`NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED=1`** plus **`NEXT_PUBLIC_PATIENT_WEB_PUSH_VAPID_PUBLIC_KEY`** (URL-safe base64 from `npx web-push generate-vapid-keys`). **`PATIENT_WEB_PUSH_VAPID_PRIVATE_KEY`** is for a future notification sender only — store securely. Subscriptions persist in **`PatientPushSubscription`**. Ship only after legal / care-team sign-off.

**EHR — Greenway / Intergy FHIR (pilot 1):** optional vars in **`apps/platform-app/.env`**, documented in **`.env.example`**: **`GREENWAY_FHIR_BASE_URL`** or **`GREENWAY_FHIR_TENANT_ID` + `GREENWAY_FHIR_ENV`**; auth via **`GREENWAY_FHIR_ACCESS_TOKEN`** and/or OAuth2 **client_credentials** (**`GREENWAY_FHIR_CLIENT_ID`**, **`GREENWAY_FHIR_CLIENT_SECRET`**, **`GREENWAY_FHIR_TOKEN_URL`**, optional **`GREENWAY_FHIR_OAUTH_SCOPE`**). **Multi-tenant:** suffix secrets with **`__<TENANT_SLUG_UPPER>`** (e.g. **`GREENWAY_FHIR_ACCESS_TOKEN__LCO`**) and store non-secret routing on **`Tenant.settings`**: **`connectors.greenwayFhir`** as **`{ "fhirTenantId", "hostEnv": "staging"|"production", optional "baseUrl" }`** — merged with global env in **`readGreenwayFhirEnvConfigForTenant`**. **Settings → Implementation hub** (test read + **Sync Patient + Encounters**, plus **recent Greenway sync activity** from `AuditEvent` metadata — no PHI in logs). **`GET|POST /api/cron/greenway-fhir-sync`** (`Authorization: Bearer` **`CRON_SECRET`**) supports **`?patientId=`** with optional **`?tenantSlug=`** (or **`GREENWAY_FHIR_SYNC_TENANT_SLUG`**); **bulk env** **`GREENWAY_FHIR_CRON_PATIENT_IDS`** (comma/semicolon/newline-separated FHIR Patient ids, max **30**) runs one sync per id when tenant slug resolves. Without a tenant slug, cron stays **probe-only** for bulk lists. **Vercel:** `apps/platform-app/vercel.json` schedules this route **every 6 hours** (ensure **`CRON_SECRET`** is set on the Platform project). Encounter search follows FHIR **`Bundle.link`** **`next`** (capped pages). Responses may include PHI — **BAA-covered** staging only. Roadmap: **`docs/PILOT_CONNECTOR_ROADMAP.md`**.

**EHR — Epic (pilot 2, e.g. Tamarack):** no production env vars in repo yet — **`docs/EPIC_FHIR_INTEGRATION_PLAN.md`**.

**FHIR fixture import (Implementation hub → paste R4 Bundle):** optional env for **non-USD Claim** lines → USD cents on Pay. Does not replace a live EHR feed. A minimal paste example (Patient + Encounter + USD Claim) lives at **`apps/platform-app/fixtures/fhir/minimal-patient-encounter-claim.example.json`**; `GET /api/integrations/status` includes **`fhirFixtureImport.exampleBundlePath`** for tooling.

| Variable | Purpose |
|----------|---------|
| `FHIR_IMPORT_FX_RATES_JSON` | JSON map of ISO currency → **USD per 1 major unit** (e.g. `{"EUR":1.10}`); merges over built-in pilot rates |
| `FHIR_IMPORT_FX_STRICT` | `1` / `true` / `yes` — reject import if any foreign line lacks a rate or matching Claims have no billable lines |
| `FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES` | Cap for inline raw text on `SourceArtifact.textPayload` for FHIR paste-import, CSV, and clearinghouse X12 (default **524288**). SHA-256 and byte length are always stored. Larger payloads omit inline text **unless** S3 is configured (see below). |

**Object storage for ingest / EDI blobs (`SourceArtifact.storageUri`, E2b2b5):** optional **S3** or S3-compatible **`PutObject`**. When **`EDI_S3_BUCKET`** is set with credentials (or `EDI_S3_ENDPOINT` for R2/MinIO), payloads **over** `FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES` are uploaded and the row stores **`s3://bucket/key`** instead of `textPayload`. Set **`EDI_BLOB_FORCE_EXTERNAL=true`** to **always** use object storage for these paths (keeps raw payload out of Postgres). Pruner/orphan policy for failed DB commits is an operational concern — prefer bucket lifecycle rules.

| Variable | Purpose |
|----------|---------|
| `EDI_S3_BUCKET` | Target bucket; enables uploads when set |
| `EDI_S3_REGION` | Region (default **`us-east-1`**; Cloudflare R2 often uses `auto`) |
| `EDI_S3_PREFIX` | Key prefix (default **`edi`**) |
| `EDI_S3_ENDPOINT` | Custom endpoint (R2, MinIO, etc.) |
| `EDI_S3_FORCE_PATH_STYLE` | `true` for many MinIO-compatible servers |
| `EDI_S3_KMS_KEY_ID` | Optional AWS KMS key for SSE-KMS |
| `EDI_BLOB_FORCE_EXTERNAL` | `true` — always `PutObject`, never store raw body in `textPayload` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SDK credentials (or IAM role / OIDC on AWS) |

**IAM (AWS example):** allow **`s3:PutObject`** on `arn:aws:s3:::YOUR_BUCKET/edi/*` (or under your `EDI_S3_PREFIX`) for the runtime identity (Vercel env or task role). For least privilege, deny `s3:*` except `PutObject` and optionally `GetObject` if a future reader fetches blobs.

**Pharmacy / NCPDP (optional, E2b2b6):** set **`NCPDP_CONNECTOR_ENABLED=1`** (or `true`) so **Settings → Integration readiness** and **`GET /api/integrations/status`** report the pharmacy lane as **test_ready** (connector kind `ncpdp_pharmacy` + format-hint helpers in repo; **no** production parser until contracted). See **`docs/CONNECTOR_STRATEGY.md`** Appendix B.

Logs: `integration.fhir_fixture.import_ok` (see [`PLATFORM_LOGGING.md`](./PLATFORM_LOGGING.md)). Integration readiness UI and `GET /api/integrations/status` include **`fhirFixtureImport`**.

**Where it surfaces:** Settings → **Integration readiness** links to the **Implementation hub** for paste-import. After import, the hub returns deep links to the new **Build** encounter and **Pay** statement. **Build** queue can show **FHIR** / **EOB** badges; **Pay** uses **`FHIR-…`** statement numbers where applicable; **Support** can label those statements; **statement detail / paid** note the import source. Staff **patient-style** balance cards: `/o/[orgSlug]/pay/patient-preview`. Onboarding rhythm: [`FIRST_CLIENT_ONBOARDING_6W.md`](./FIRST_CLIENT_ONBOARDING_6W.md); product framing: [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md).

Optional later:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_*` | Same brand overrides as marketing if needed in the app |

Local template: `apps/platform-app/.env.example`.

---

## Database (production) — Step 4 in detail

The **platform app** (`app.anang.ai`) is not a static site: sign-in and tenant pages read **Postgres** via Prisma.

### Step 4 — beginner walkthrough (free Postgres on Neon)

You do **not** need to install Postgres on your PC. A **hosted** database gives you a URL; the app and your laptop both connect to that same URL.

**A. Create the database (one time)**

1. Sign up at [Neon](https://neon.tech) (or use [Supabase](https://supabase.com) — both offer free tiers).
2. Create a **new project**. Pick a region close to your Vercel region if prompted.
3. Open the project’s **Dashboard** and find the **connection string** for Postgres. It usually looks like  
   `postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require`.
4. Copy the entire string. Treat it like a password — do not paste it in chat or commit it to git.

**B. Give the URL to Vercel**

1. Vercel → **Anang Platform** project (the one whose Root Directory is `apps/platform-app`) → **Settings → Environment Variables**.
2. Add **`DATABASE_URL`** = paste the connection string. Scope: **Production** (and **Preview** if you want preview deployments to work against a DB too — you can use the same Neon DB while learning, or create a second Neon branch later).
3. **Save**, then **Deployments → Redeploy** the latest production deploy so the new variable is picked up.

**C. Create tables and seed data (one time, from your laptop)**

Your code already defines the schema (Prisma). You “push” that shape to the empty Neon database, then “seed” starter rows (tenants, operator users, sample RCM rows — see `prisma/seed.ts`).

**Recommended (avoids clobbering local Docker Postgres):** put the **same** Neon `DATABASE_URL` you use in Vercel into a file the repo **never commits**:

1. Copy `apps/platform-app/.env.neon.example` → `apps/platform-app/.env.neon`.
2. Edit `.env.neon` so `DATABASE_URL` is your real Neon string (one line, quoted is fine).
3. From the **repo root** (folder with `package-lock.json`), run **migrations** (preferred) or **`db:push`** (legacy quick sync):

**Preferred — versioned migrations**

```powershell
npm run db:migrate:deploy -w @anang/platform-app
npm run db:seed:neon -w @anang/platform-app
```

**Neon-only connection string (keeps local `.env` on Docker Postgres):** after you fill `apps/platform-app/.env.neon` with Neon’s `DATABASE_URL`, run:

```powershell
npm run db:migrate:deploy:neon -w @anang/platform-app
```

Use the same `DATABASE_URL` as Vercel (via `apps/platform-app/.env.neon` or a one-line shell override). `db:migrate:deploy` applies everything under `apps/platform-app/prisma/migrations` and records rows in `_prisma_migrations`.

**Short checklist — apply migrations to Neon from your machine**

1. In the [Neon console](https://console.neon.tech), open your project → **Connection details** → copy the Postgres URI (include `sslmode=require` if Neon shows it).
2. Put that string in `apps/platform-app/.env.neon` as `DATABASE_URL=...` (create the file from `.env.neon.example` if needed). Do not commit this file.
3. From the **repo root**: `npm run db:migrate:deploy:neon -w @anang/platform-app` (or set `DATABASE_URL` temporarily and run `npm run db:migrate:deploy -w @anang/platform-app`).
4. If this database was first created with **`db:push` only**, run the baseline `migrate resolve` once (see the next subsection) before future deploys.
5. Optional empty DB: `npm run db:seed:neon -w @anang/platform-app` for demo tenants and claims.

Vercel production builds should keep using `DATABASE_URL` from project env vars so each deploy runs the same migrations against Neon (see the Vercel build command earlier in this doc).

**Existing Neon DB that was created with `db:push` only** (tables already exist): you must **baseline** the first migration once so Prisma does not try to re-create the full schema:

```powershell
cd apps/platform-app
npx prisma migrate resolve --applied 20260329203000_baseline
npx prisma migrate deploy
```

Then run `db:seed:neon` only if you still need seed data. New empty databases skip `migrate resolve` and only need `db:migrate:deploy`.

**Legacy — schema push without migration history**

```powershell
npm run db:push:neon -w @anang/platform-app
npm run db:seed:neon -w @anang/platform-app
```

Those scripts use Node’s `--env-file=.env.neon` so your normal `apps/platform-app/.env` can keep pointing at **localhost** for local Docker.

- **`db:migrate:deploy`** (or local `npm run db:migrate -w @anang/platform-app` for `migrate dev`) is the production-oriented workflow; CI verifies `deploy` against a fresh Postgres.
- **`db:push:neon`** still works for ad-hoc drift repair but does not update `_prisma_migrations`; avoid it once you rely on migrate.
- **`db:seed:neon`** inserts seed data so login and tenant routes have something to read.

**Alternate:** set `DATABASE_URL` only for one terminal session, then use the plain `db:push` / `db:seed` scripts (they read `apps/platform-app/.env`, which is usually **local Docker** — so this only works if you temporarily replace that value or export `DATABASE_URL` in the shell, which overrides `.env` for Prisma):

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
```

If either command errors, read the message: common fixes are a typo in the URL, firewall/VPN blocking outbound connections, or Node/npm not run from the **monorepo root**.

**D. Smoke test**

Open `https://app.anang.ai/login` (or your platform URL) and sign in per [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md): virtual mailbox `access@anang.ai` (or your `PLATFORM_VIRTUAL_EMAIL`) with **`PLATFORM_LOGIN_PASSWORD`** (legacy defaults included in dev only — change in deploy).

---

### Step 4 — short checklist (for those who already know hosted Postgres)

1. **Provision a database** (e.g. [Neon](https://neon.tech), Supabase, RDS). Copy the Postgres connection string.
2. In the **platform** Vercel project → **Settings → Environment Variables**, add **`DATABASE_URL`** = that connection string (mark as sensitive). Redeploy.
3. **Apply migrations + seed** once from a trusted machine (your laptop or CI), pointing at the **same** `DATABASE_URL`:

```powershell
npm run db:migrate:deploy -w @anang/platform-app
npm run db:seed:neon -w @anang/platform-app
```

(If this database was previously maintained with **`db:push`**, baseline with `npx prisma migrate resolve --applied 20260329203000_baseline` from `apps/platform-app` before the first `deploy`, as in section C.)

**Ad-hoc push** (no migration history): `db:push:neon` / `db:push` + `db:seed` as in section C — not recommended after you standardize on **`db:migrate:deploy`** in Vercel and CI.

**Vercel — platform build:** use the platform **Build Command** from the Vercel settings section above (`db:migrate:deploy` before `next build`).

Until steps 1–3 succeed, the marketing site can work while the platform returns database errors on data routes.

---

## Local Postgres (optional)

From repo root:

```powershell
docker compose up -d
```

Default URL matches `apps/platform-app/.env.example`.

---

## Custom domains

- Marketing: apex + `www` → marketing Vercel project.
- Product: `app.` subdomain → platform Vercel project.
- Point marketing CTAs at `https://app.anang.ai/login` (or your real app host).

---

## Future infra (AWS / Azure)

Prisma + TypeScript domain logic in the Next app can later move behind a dedicated Node API; the database remains PostgreSQL. No microservice split is required to start.

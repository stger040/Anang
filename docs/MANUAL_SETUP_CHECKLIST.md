# Manual setup checklist (your environment)

**Purpose:** One list of what **you** configure outside the repo: accounts, secrets, DNS, legal/compliance, and one-time database steps. In-repo code (including Stripe checkout + webhook handlers) still needs these to work in production.

**Related:** [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`CLIENT_SHOWCASE.md`](./CLIENT_SHOWCASE.md) · [`PATH_TO_FULL_PRODUCT.md`](./PATH_TO_FULL_PRODUCT.md) · [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) · [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md) (SMS / opt-in patterns) · **[`FOUNDER_BUILD_GUIDE.md`](./FOUNDER_BUILD_GUIDE.md)** (Neon vs seed data, non-engineer checklist)

---

## 1. Source control & CI (if not done)

1. Initialize or connect a **Git** remote (e.g. GitHub); keep **secrets and `.env*` out of git** (see root `.gitignore`).
2. Optionally wire **CI** (build/lint on push) — not required for Vercel deploys but recommended.

---

## 2. Vercel — two projects, monorepo install

1. Create **two** Vercel projects from the **same** repo: **marketing** (`apps/marketing-site`) and **platform** (`apps/platform-app`).
2. Set **Root Directory**, **Install Command** (`cd ../.. && npm ci`), and **Build Command** per [`DEPLOYMENT.md`](./DEPLOYMENT.md).
3. **Custom domains:** apex/`www` → marketing; `app.` (or chosen host) → platform. Update marketing CTAs to the real login URL.

---

## 3. Postgres (Neon, Supabase, etc.)

1. **Provision** a managed Postgres instance; copy **`DATABASE_URL`** (treat as a secret).
2. In the **platform** Vercel project → **Environment Variables**, add **`DATABASE_URL`** for Production (and Preview if desired). **Redeploy** after changes.
3. **Apply schema + seed** once against that same database from a trusted machine (see §7). Until this succeeds, tenant routes will error after login.

---

## 4. Platform app — auth & branding

1. Set **`AUTH_SECRET`** (required) and preferably **`AUTH_URL`** to the public platform origin. For enterprise SSO, add **`AUTH_OIDC_ISSUER`**, **`AUTH_OIDC_ID`**, **`AUTH_OIDC_SECRET`** (optional **`AUTH_OIDC_NAME`**) — register redirect **`{AUTH_URL}/api/auth/callback/oidc`** with the IdP. See **`apps/platform-app/.env.example`** and **`docs/DEPLOYMENT.md`**.
2. Keep **`PLATFORM_LOGIN_PASSWORD`**, **`PLATFORM_VIRTUAL_EMAIL`**, and **`NEXT_PUBLIC_PLATFORM_VIRTUAL_EMAIL`** for staging / dev. **Never ship well-known defaults** to shared hosts. Legacy **`DEMO_*`** vars still work if the new names are unset.
3. Optionally set **`NEXT_PUBLIC_*`** brand overrides if you want the app to match marketing without code changes.

---

## 5. Stripe (optional — Pay checkout)

1. **Stripe Dashboard:** Create or use an account; use **test mode** first.
2. **API keys:** Create a **secret** key (`sk_test_…`). Add **`STRIPE_SECRET_KEY`** to the **platform** Vercel env (and local `.env` for dev).
3. **Webhook:** Add endpoint URL  
   `https://<your-platform-host>/api/webhooks/stripe`  
   Subscribe at minimum to **`checkout.session.completed`**. Copy the **signing secret** (`whsec_…`) into **`STRIPE_WEBHOOK_SECRET`** on Vercel (and local for CLI/`stripe listen` testing).
4. **Redirects:** Set **`NEXT_PUBLIC_APP_ORIGIN`** to the canonical public URL of the platform app (e.g. `https://app.anang.ai`) so Checkout **success/cancel** URLs are correct. If omitted, the app uses `VERCEL_URL` on Vercel or `http://localhost:3001` locally — confirm that matches how **you** open the app.
5. **`ANANG_PAYMENTS_LIVE`:** Leave unset or `0` for test keys; set **`1`** only when you intentionally use **live** Stripe keys (integration status treats this as “live”).
6. **Database:** After pulling schema changes, run **`db:push`** / **`db:push:neon`** so column **`Payment.stripeCheckoutSessionId`** exists (see §7).
7. **Compliance:** For real patient payments, involve **PCI** and **merchant agreement** counsel — not covered by this repo.

---

## 6. Other integrations (optional)

| Area | What you add |
|------|----------------|
| **EHR / FHIR** | Sandbox + production access, **`EHR_FHIR_CLIENT_ID`** (and future secrets), **BAA**, analyst time |
| **Email / SMS** | **`SENDGRID_API_KEY`**, **`RESEND_API_KEY`**, or **`TWILIO_ACCOUNT_SID`** (+ related secrets). For **billing SMS** (short code / 10DLC): carrier registration, **TCPA** consent, **HELP/STOP**, message templates—see [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md) § “SMS → web”. |
| **Clearinghouse** | Partner contract, enrollment, **`CLEARINGHOUSE_API_KEY`** (or vendor-specific vars) |

The **Settings → Integration readiness** card and **`GET /api/integrations/status`** reflect presence of these env vars only — they do not replace vendor onboarding.

---

## 7. Prisma — schema on the DB you actually use

After cloning or after schema changes (e.g. new Stripe idempotency column), **you** must run against the **`DATABASE_URL`** that matches the environment:

- **Local Docker Postgres:** from repo root, e.g. `npm run db:push -w @anang/platform-app` and `npm run db:seed -w @anang/platform-app`.
- **Neon without touching local `.env`:** copy **`.env.neon.example`** → **`.env.neon`**, paste Neon URL, then `npm run db:push:neon -w @anang/platform-app` and `npm run db:seed:neon -w @anang/platform-app`.

If **Windows** shows **`EPERM`** on Prisma engine rename, close processes locking `.prisma` / IDE, or run the same commands in **WSL** / on **CI** / **Vercel** shell.

---

## 8. Legal, security, and enterprise

1. **HIPAA / BAA:** Execute BAAs with vendors you choose (hosting, DB, Stripe, comms, etc.); this repo does not supply legal agreements.
2. **Pilot contracts:** MSAs, DPAs, and pricing are **your** paperwork.
3. **SOC 2 / pen tests:** Your audit track, not automated here.

---

## 9. Quick “is it working?” pass

| Check | Action |
|-------|--------|
| Deploy | Open **`/api/health`** and **`/api/version`** on the platform host. |
| DB | Log in with a seeded operator; open a tenant **Pay** statement — no DB errors. |
| Stripe | With keys + webhook secret set, use **Pay with Stripe (test)** on a statement with balance > 0; confirm **`Payment`** row and balance drop after webhook. |
| Integration JSON | **`/api/integrations/status`** — lanes move off `not_configured` when env vars are set. |

---

## 10. Local dev (optional)

1. **`docker compose up -d`** for local Postgres if you use the default **`DATABASE_URL`** in `.env.example`.
2. **Root `npm install`** (workspaces). If install fails on file locks, retry after closing other Node/IDE locks on the repo.

This checklist is the **manual** counterpart to what ships in code; keep it next to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full command snippets.

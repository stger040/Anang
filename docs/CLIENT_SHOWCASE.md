# Pilot runbook — access, URLs, smoke checks

**Purpose:** Single reference for **staging / pilot** URLs, how operators sign in, and what to verify before a customer session. This is **not** a “demo-only” artifact — it matches how the platform runs while EHR and SSO are still being wired.

**Related:** [`PLATFORM_OVERVIEW.md`](./PLATFORM_OVERVIEW.md) · [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`MANUAL_SETUP_CHECKLIST.md`](./MANUAL_SETUP_CHECKLIST.md) · [`FOUNDER_BUILD_GUIDE.md`](./FOUNDER_BUILD_GUIDE.md) · [`EPIC_AND_TEST_DATA.md`](./EPIC_AND_TEST_DATA.md)

---

## 1. Surfaces

| Surface | Default URL | Role |
|--------|-------------|------|
| Marketing | `https://anang.ai` (or your Vercel URL) | Positioning, pilots |
| Platform login | `https://app.anang.ai/login` (customer: `…/login?org={slug}`) | Auth.js: optional global OIDC + optional per-tenant OIDC + password policy |
| Health | `https://app.anang.ai/api/health` | `{ ok, serviceId, ts }` |
| Version | `https://app.anang.ai/api/version` | Build identity |
| Integrations | `https://app.anang.ai/api/integrations/status` | Env-driven lanes (no secrets) |

---

## 2. Prerequisites

| Requirement | Why |
|-------------|-----|
| **`DATABASE_URL`** (e.g. Neon) on the platform deploy | Tenant routes need Postgres. |
| Schema + seed (or migrations) applied to **that** database | See [`FOUNDER_BUILD_GUIDE.md`](./FOUNDER_BUILD_GUIDE.md). |
| Monorepo `npm ci` + workspace build on Vercel | See `DEPLOYMENT.md`. |

### Stripe (optional — test checkout)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_ORIGIN` → Pay **Pay with Stripe (test)** on statements with balance. Production posture is counsel + live keys.

---

## 3. Sign-in

**Auth:** [Auth.js](https://authjs.dev) + **`/api/auth/[...nextauth]`**. Configure **`AUTH_SECRET`** everywhere. **Global** OIDC: **`AUTH_OIDC_*`**. **Per-tenant** OIDC + policy (`local_only` / `sso_allowed` / `sso_required`): admin UI + **`AUTH_OIDC_CLIENT_SECRET__…`**; see [`CLIENT_IT_OIDC_ONBOARDING.md`](./CLIENT_IT_OIDC_ONBOARDING.md). Staging password path remains for pilots without an IdP yet.

**Virtual mailbox** (optional pilot: shared password maps to a real `User` row via server default profile): set `PLATFORM_VIRTUAL_EMAIL` / `NEXT_PUBLIC_PLATFORM_VIRTUAL_EMAIL`. Default in repo: `support@anang.ai`.

Server-side profile mapping (virtual mailbox only) lives in [`apps/platform-app/src/lib/login-routing.ts`](../apps/platform-app/src/lib/login-routing.ts). Prefer signing in with **your real user email** (same `PLATFORM_LOGIN_PASSWORD` until SSO).

**Seed (`prisma/seed.ts`):** one tenant **`synthetic-test`** — staff users **`rick@anang.ai`** (super admin + tenant admin membership) and **`rick@stginnovation.com`** (staff). **Patient** row **`stger040@gmail.com`** (Sam TestPatient) for Pay / portal rehearsal. All modules enabled on the tenant. Re-run seed after pulling: `npm run db:seed -w @anang/platform-app` (or your Neon seed script).

---

## 4. Suggested walkthrough (product review)

1. Sign in → **`rick@anang.ai`** (super admin) → **`/admin`**, or **`rick@stginnovation.com`** → **`/o/synthetic-test/dashboard`**.  
2. **Build** — encounter → draft / issues  
3. **Pay** — statements → detail → optional Stripe test (patient with Gmail on file)  
4. **Cover** — assistance cases  
5. **Support** — task queue  
6. **Connect** — claim timeline  
7. **Insight** — KPIs  
8. **Settings** (tenant admin) — users, entitlements ; super admin → **`/admin`**  

---

## 5. Capability snapshot

| Area | Status |
|------|--------|
| Multi-tenant + module gating | Shipped |
| Per-staff module caps | Shipped — super-admin invite/add + **tenant admin Settings → Users** |
| Build / Pay / Connect / Insight | Shipped (MVP depth) |
| Cover / Support | Staff queues + intake (DB-backed) |
| Auth | Auth.js — password + optional global / per-tenant OIDC |
| EHR / clearinghouse | **Greenway / Intergy** FHIR lane env-scaffold + hub test (**pilot 1**); **Epic** (**pilot 2**, e.g. Tamarack) — plan only until App Orchard; clearinghouse still contract-gated — [`PILOT_CONNECTOR_ROADMAP.md`](./PILOT_CONNECTOR_ROADMAP.md) |
| Stripe | Optional test Checkout + webhook |

---

## 6. GitHub, deploy, and testing as you (super-admin + staff + patient)

**Push to GitHub (once):** Monorepo root is the git root (`DEPLOYMENT.md` § source control). Ensure **`.env`** files are **not** committed; use **`.env.example`** as the template. After `git push`, connect **two Vercel projects** (marketing + platform) with **Root Directory** `apps/marketing-site` / `apps/platform-app` and root **`npm ci`** / workspace **`build`** commands — **`DEPLOYMENT.md`** § Vercel.

**Personal super-admin:** Seed includes **`rick@anang.ai`** with **`SUPER_ADMIN`**. Sign in at **`/login`** → **`/admin`** to manage tenants, entitlements, and invites. Open **`/o/synthetic-test/...`** from admin when you want the clinic workspace.

**Clinic staff view:** Seed includes **`rick@stginnovation.com`** as **`STAFF`** on **`synthetic-test`**. After sign-in you land on **`/o/synthetic-test/dashboard`**. Module visibility follows entitlements and optional allow-lists (`TENANCY_AND_MODULES.md`).

**Patient-style testing:** Patient flows use **magic links** and **`/p/{orgSlug}/…`** (and related APIs), not the staff workspace. Use seeded **Patient** + **statement** data and staff actions in **Pay** (“Create patient link” / similar) to generate URLs; second **email** is fine for **Auth.js staff** accounts, but **patient** sessions are **portal-cookie / link** based — see **`PATIENT_SCENARIOS_AND_MOBILE_APP.md`**.

**PHI posture:** Treat any deploy with **real** clinic integrations or **live** Greenway tokens as **governed** (BAA, retention, no casual logging of payloads) — **`PLATFORM_LOGGING.md`**, **`DEPLOYMENT.md`**.

**Greenway pilot ops:** **Settings → Implementation hub** shows **Recent Greenway activity** (audit). Scheduled **`/api/cron/greenway-fhir-sync`** (see **`apps/platform-app/vercel.json`**) can run **bulk** sync when **`GREENWAY_FHIR_CRON_PATIENT_IDS`** + tenant slug env are set — **`PILOT_CONNECTOR_ROADMAP.md`**.

---

## 7. Pre-flight checklist

- [ ] `/api/health` OK  
- [ ] Login → dashboard without DB errors  
- [ ] Strong `PLATFORM_LOGIN_PASSWORD` on any shared environment  
- [ ] Neon (or prod DB) has current schema  

---

## 8. Cedar-aligned positioning

*Patient financial platform (Pay, Cover, Support, Pre) plus **Build** (denial prevention) and **Connect** (payer / EDI depth).*  

Depth comparison: `IMPLEMENTATION_PLAN.md`, `PATH_TO_FULL_PRODUCT.md`.

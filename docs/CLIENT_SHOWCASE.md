# Client showcase — demo the product today

**Purpose:** Give founders and sales a **single place** for URLs, logins, a short demo path, and **honest** notes on what is product-ready vs scaffold — so you can meet clients without guessing.

**Related:** [`PLATFORM_OVERVIEW.md`](./PLATFORM_OVERVIEW.md) · [`PATH_TO_FULL_PRODUCT.md`](./PATH_TO_FULL_PRODUCT.md) (Cedar-class gap list + what you supply vs what we build) · [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`EPIC_AND_TEST_DATA.md`](./EPIC_AND_TEST_DATA.md)

---

## 1. What to show (public + product)

| Surface | Default URL | Role |
|--------|-------------|------|
| Marketing | `https://anang.ai` (or your Vercel URL) | Positioning, modules, pilot CTA |
| Platform login | `https://app.anang.ai/login` | Demo auth + tier picker |
| Platform health | `https://app.anang.ai/api/health` | JSON `{ ok, serviceId, ts }` — “is deploy alive?” |
| Platform version | `https://app.anang.ai/api/version` | JSON `{ version, serviceId, commit? }` |
| Integration snapshot | `https://app.anang.ai/api/integrations/status` | JSON lanes for EHR / payments / comms / clearinghouse (env-driven, no secrets) |

Replace hosts with your real Vercel domains if different.

---

## 2. Prerequisites (non-negotiable for a real demo)

| Requirement | Why it matters |
|---------------|----------------|
| **Postgres + `DATABASE_URL`** on the **platform** Vercel project | Without it, tenant routes error after login. |
| **`npm run db:push`** (or migrate) **+ `npm run db:seed`** against **that same DB** once | Otherwise tables or demo rows are missing. |
| **Marketing + platform** builds using monorepo root `npm ci` + workspace build (see `DEPLOYMENT.md`) | Wrong install dir = broken deploy. |

These are the **main bottlenecks** if someone opens the app and sees errors: almost always missing DB URL, stale deploy, or seed not run.

---

## 3. Demo logins (seeded)

**Demo password:** whatever you set as `DEMO_LOGIN_PASSWORD` (default in docs is often `demo`). **Do not** use defaults in production without rotating.

### Tier picker (`demo@anang.ai` + password + choose tier)

Uses [`apps/platform-app/src/lib/demo-tiers.ts`](../apps/platform-app/src/lib/demo-tiers.ts) — maps tier → seeded user email.

| Tier | Lands as | Story |
|------|----------|--------|
| **Enterprise** | LCO admin | All modules (`/o/lco/...`) |
| **Growth** | Tamarack staff | Subset; first membership → **`/o/hayward/...`** (see below) |
| **Essentials** | Demo tenant staff | Pay + Insight + Core (`/o/demo/...`) |
| **Platform admin** | Super admin | `/admin` (tenant list, audit) |

### Direct seeded emails (same demo password)

| Email | Role | Typical first URL after login |
|-------|------|-------------------------------|
| `super@anang.internal` | Platform super admin | `/admin` |
| `admin@lco.anang.demo` | Tenant admin (LCO) | `/o/lco/dashboard` |
| `rcm@tamarack.anang.demo` | Staff (Tamarack) | `/o/hayward/dashboard` (Hayward row created before Ashland in seed) |
| `viewer@demo.anang.demo` | Staff (demo tenant) | `/o/demo/dashboard` |

**Tamarack two sites:** same display name **Tamarack Health**; slugs **`hayward`** and **`ashland`**. Same RCM user can open either: `/o/hayward/...` or `/o/ashland/...`.

### Synthetic data

All demo patients, encounters, claims, statements, etc. come from **[`apps/platform-app/prisma/seed.ts`](../apps/platform-app/prisma/seed.ts)** — **not PHI**. Say clearly: *“This is synthetic seed data for evaluation.”*

---

## 4. Suggested 12‑minute demo script

1. **Marketing (1 min)** — Problem, modules, book a call / sign in.
2. **Login (1 min)** — `demo@anang.ai`, pick **Enterprise**, land LCO.
3. **Overview dashboard (1 min)** — `.../dashboard` — oriented around modules.
4. **Build (3 min)** — Encounters list → open an encounter → claim draft / AI rationale copy (your differentiator vs “portal only”).
5. **Pay (2 min)** — Statements → drill to balance / lines (no real card processing yet).
6. **Connect (2 min)** — Claims list → one claim detail / timeline.
7. **Insight (1 min)** — KPI-style page (depth varies).
8. **Cover / Support (1 min)** — Open each; **say explicitly:** *“Workflow scaffold — roadmap matches Cedar-class coverage and ops surfaces.”*
9. **Admin / settings (1 min)** — Tenant settings or `/admin` if super admin — entitlements, audit story.

**If the room is RCM-heavy:** spend more time on Build + Connect; if patient-experience-heavy, Pay + cover roadmap.

---

## 5. Capability reality (set expectations)

| Area | Today | Client message |
|------|--------|----------------|
| Multi-tenant shell, module gating | ✅ Working | “SKU honesty — you only buy what you use.” |
| Build / Pay / Connect / Insight | ✅ MVP with seeded depth | “Live product shape; integrations come next.” |
| Cover / Support | 🔲 Scaffold UI | “Same platform contract; workflows next.” |
| Auth | Demo cookie / password | “SSO + IdP is the production path.” |
| EHR / FHIR / clearinghouse | Not wired | “Your feed design during implementation.” |
| Payments | Not production Stripe | “Gateway in pilot phase.” |
| HIPAA / BAAs | Your legal/infra process | “Demo environment is not a HIPAA production.” |

This is **enough to sell discovery and pilot**; it is **not** a go-live RCM replacement until integrations and compliance work are done.

---

## 6. Bottlenecks checklist (before a big meeting)

- [ ] `GET https://app.../api/health` returns `"ok": true`
- [ ] Login works; `/o/lco/dashboard` loads without DB error
- [ ] Seed has been run against **production** Neon (or demo DB), not only localhost
- [ ] Decide whether to **rotate** demo password and share credentials **outside email** (1Password, etc.)
- [ ] Calendly / contact links on marketing match your real booking flow (`NEXT_PUBLIC_ANANG_CALENDLY` etc.)

---

## 7. After the demo (typical next steps)

1. **Pilot SOW** — modules, sites, timeline (see `BUILD_PLAN.md` GTM sections).
2. **Data** — which EHR, sandbox vs prod PHI, interface specs (`EPIC_AND_TEST_DATA.md`).
3. **Environments** — staging tenant, SSO test, BAA package.

---

## 8. Cedar-aligned story (one sentence)

*“One patient financial platform: Pay-style billing, Cover-style coverage/denials positioning, Support-style ops — plus our Claims Build and Connect depth; demo shows the shell and the richest MVP routes.”*

For more Cedar comparison, see **`IMPLEMENTATION_PLAN.md`** Part 0A and Cedar reference section.

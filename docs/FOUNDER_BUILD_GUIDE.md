# Founder guide — how we build “for real” (Neon, no secrets in git)

**Who this is for:** You are driving a full product but are **not** a day-to-day engineer. This explains what “the right way” means in plain language and what **you** supply vs what **the codebase** supplies.

**Related:** [`MANUAL_SETUP_CHECKLIST.md`](./MANUAL_SETUP_CHECKLIST.md) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) · [`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md)

---

## 1. Two different ideas people mix up

| Idea | What it actually is |
|------|---------------------|
| **Where the database lives** | **Neon** (or RDS, etc.) = a **real** Postgres server on the internet. Your app connects with a **connection string**. Nothing about that is “fake.” |
| **What rows are inside the database** | Until an **EHR / PM** feed is connected, engineers use **synthetic seed data**: fake **names and balances** that **look** like a hospital so screens work. That is **not PHI** and is **standard** for staging. It is **not** a substitute for production PHI. |

So: **Neon = real infrastructure.** **Seed data = intentional demo content**, usually reset or replaced as integrations go live.

You asked not to rely on “fake data on my local computer.” **Agreed on strategy:**

- Use **Neon** as the **system of record** for dev/staging (and later production with proper BAAs).
- Keep `apps/platform-app/.env.neon` with your **Neon `DATABASE_URL`** — **never commit** it (`.gitignore` already excludes `.env*`).
- Optional: skip **Docker Postgres** on your laptop entirely if you only ever hit Neon.

---

## 2. What we ran for you (commands)

From the **repo root**, these are the **Neon** scripts (they read `apps/platform-app/.env.neon`):

```powershell
cd c:\Users\stger\Dev\Enterpises\Medtech_placeholder
npm run db:push:neon -w @anang/platform-app
```

If Prisma stops with a **data loss** warning (often when adding a new unique index), use the **dev-only** variant:

```powershell
npm run db:push:neon:force -w @anang/platform-app
```

Then load (or refresh) demo rows:

```powershell
npm run db:seed:neon -w @anang/platform-app
```

**Warning:** `db:seed:neon` **wipes and recreates** the synthetic dataset defined in `prisma/seed.ts`. Do **not** run it against a database that already has **real patient data** unless you intend to destroy it.

---

## 3. What you need on your end (minimal)

1. **Neon project** — you have this. One **connection string** per environment (dev branch vs production branch is a good Neon pattern).
2. **`apps/platform-app/.env.neon`** — contains `DATABASE_URL=...` pointing at Neon. Only on your machine and CI secrets — **not in git**.
3. **Vercel (or host)** — the **same** `DATABASE_URL` on the **platform** project so production hits `your real Neon branch`, not localhost.
4. **Legal / vendor** — BAAs, Stripe business account, SMS registration when you go live — see [`MANUAL_SETUP_CHECKLIST.md`](./MANUAL_SETUP_CHECKLIST.md).

You do **not** need to understand Prisma or SQL to **own** these steps—you only need to **paste the right string in the right dashboard** and keep secrets out of chat/email.

---

## 4. “Full software” — honest phasing

A Cedar-class platform is **years** of product + integrations + compliance. The **right way** is:

| Phase | What exists |
|-------|----------------|
| **Now** | Multi-tenant app, modules (Build, Pay, Cover, …), **Neon-backed** schema, **synthetic** tenants for demos, optional Stripe/SMS hooks. |
| **Next** | **Patient** billing web + magic links, auth hardening (SSO), real **EHR read** to replace seed. |
| **Later** | Clearinghouse, production comms, native apps, SOC2 posture. |

The repo tracks **engineering truth** in `IMPLEMENTATION_PLAN.md`, `BUILD_PLAN.md`, and `FULL_PLATFORM_CHECKLIST.md`. You steer **priority**; the codebase grows in **vertical slices** (one end-to-end workflow at a time).

---

## 5. If you’re ever unsure

- **“Is this using my Neon?”** — If you run `db:*:neon` scripts or set `DATABASE_URL` in Vercel to Neon, **yes**.
- **“Is this real patient data?”** — **No**, until you connect a certified EHR feed under a BAA. Seed data is labeled **synthetic** in the UI (“Synthetic demo data · not PHI”).
- **“Did we do it the lazy way?”** — Using Neon + seed for staging is **industry standard**. The **wrong** lazy would be committing secrets or testing PHI in an ungoverned project.

When you’re ready, tell your engineering lead **which environment** you want next (e.g. “Vercel prod → Neon production branch only” or “Epic sandbox read-only”) and work stays aligned with this guide.

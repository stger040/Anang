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

For **platform**:

```bash
cd ../.. && npm run build -w @anang/platform-app
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

Optional later:

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Signing key once auth upgrades beyond demo cookies |
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

**C. Create tables and demo data (one time, from your laptop)**

Your code already defines the schema (Prisma). You “push” that shape to the empty Neon database, then “seed” starter rows (orgs, demo user, etc.).

1. On your machine, open a terminal in the **repo root** (`Medtech_placeholder` folder — where `package-lock.json` lives).
2. Set `DATABASE_URL` **only for this terminal session** (replace the placeholder with your real string from Neon):

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
```

3. Still in the repo root, run:

```powershell
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
```

- **`db:push`** creates/updates tables in Neon to match the Prisma schema (good for early production; later you may switch to versioned **`db:migrate`**).
- **`db:seed`** inserts demo data so login and tenant routes have something to read.

If either command errors, read the message: common fixes are a typo in the URL, firewall/VPN blocking outbound connections, or Node/npm not run from the **monorepo root**.

**D. Smoke test**

Open `https://app.anang.ai/login` (or your platform URL) and use the [demo tier flow](./TENANCY_AND_MODULES.md) (`demo@anang.ai` / `demo` by default unless you changed seed data).

---

### Step 4 — short checklist (for those who already know hosted Postgres)

1. **Provision a database** (e.g. [Neon](https://neon.tech), Supabase, RDS). Copy the Postgres connection string.
2. In the **platform** Vercel project → **Settings → Environment Variables**, add **`DATABASE_URL`** = that connection string (mark as sensitive). Redeploy.
3. **Apply schema + seed** once from a trusted machine (your laptop or CI), pointing at the **same** `DATABASE_URL`:

```powershell
$env:DATABASE_URL = "postgresql://USER:PASSWORD@HOST/DB?sslmode=require"
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
```

Use **`db:migrate`** instead of **`db:push`** when you adopt versioned Prisma migrations for production discipline.

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

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

Set these in **Vercel → Project → Environment Variables** or copy from `apps/marketing-site/.env.example` locally.

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

## Database (production)

1. Provision **PostgreSQL** (Neon, Supabase, RDS, Azure Database for PostgreSQL, etc.).
2. Set `DATABASE_URL` on the **platform** Vercel project.
3. Apply schema and seed from a trusted environment (CI or your laptop with prod URL), e.g.:

```powershell
# Use the production DATABASE_URL only from a secure context
npm run db:migrate -w @anang/platform-app
# or for early phases: db:push (less ideal for prod discipline)
npm run db:seed -w @anang/platform-app
```

For production, prefer **Prisma Migrate** (`db:migrate`) over `db:push` once you introduce migration history.

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

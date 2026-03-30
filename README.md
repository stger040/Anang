# Anang — revenue cycle platform monorepo

**Anang** is an AI-native, multi-tenant revenue cycle platform (Build, Pay, Connect, Insight, Support, Cover) with a separate public marketing site.

| Surface | Package | Default port | Host (prod intent) |
|---------|---------|--------------|--------------------|
| Marketing site | `@anang/marketing-site` | 3000 | `anang.ai` |
| Product app | `@anang/platform-app` | 3001 | `app.anang.ai` |

| Doc | Purpose |
|-----|---------|
| **`docs/PLATFORM_OVERVIEW.md`** | Product framing & onboarding |
| **`docs/ARCHITECTURE.md`** | Why two apps, module model, mock vs prod |
| **`docs/DEPLOYMENT.md`** | **GitHub + Vercel + Postgres** (read before first deploy) |
| **`docs/TENANCY_AND_MODULES.md`** | Tenants, entitlements, seeds |
| **`docs/ROADMAP.md`** | Suggested phases |
| **`IMPLEMENTATION_PLAN.md`**, **`BUILD_PLAN.md`** | Broader planning artifacts |

## Prerequisites

- **Node.js** 20+ and **npm** 10+ (repo pins `packageManager` in root `package.json`)
- **Docker Desktop** (optional) for local PostgreSQL — see `docker-compose.yml`
- **Git** (for clone / push to GitHub)

## Workspaces

Root `package.json` uses npm workspaces: `apps/*` and `packages/*`.

Packages: `@anang/marketing-site`, `@anang/platform-app`, `@anang/brand`, `@anang/config`, `@anang/types`, `@anang/ui`, etc.

## First-time setup (fresh machine)

From your clone root (example paths shown for Windows):

```powershell
# 1) Clone from GitHub (after the repo exists), then:
cd <your-clone-path>\Anang

# 2) Install all workspace dependencies (run at repo root only)
npm install

# 3) Env templates — copy to real .env files (these are gitignored)
Copy-Item apps\platform-app\.env.example apps\platform-app\.env -Force
# Optional: marketing overrides
if (Test-Path apps\marketing-site\.env.example) {
  Copy-Item apps\marketing-site\.env.example apps\marketing-site\.env -Force
}

# 4) Start Postgres (optional local DB — matches docker-compose.yml)
docker compose up -d

# 5) Schema + seed (requires DATABASE_URL in apps\platform-app\.env and a running Postgres)
npm run db:push -w @anang/platform-app
npm run db:seed -w @anang/platform-app
```

### Verify install (no database required for build/lint)

From repo root:

```powershell
npm run build
npm run lint
```

**Prisma:** after you copy `apps\platform-app\.env.example` → `apps\platform-app\.env`, Prisma loads `DATABASE_URL` from that file when run from the platform app:

```powershell
npm run db:validate
```

If `.env` does not exist yet, either create it first or set a placeholder only for this command:

```powershell
$env:DATABASE_URL = "postgresql://anang:anang@127.0.0.1:5432/anang?schema=public"
npm run db:validate
```

## Dev servers

```powershell
npm run dev
```

- Marketing: http://localhost:3000  
- Platform: http://localhost:3001/login  

Or run one app: `npm run dev:marketing` / `npm run dev:platform`

**Demo sign-ins** are on `/login` (cookie-based; not production auth).

## Scripts (root)

| Script | Description |
|--------|-------------|
| `npm run dev` | Marketing + platform (concurrently) |
| `npm run dev:marketing` | Marketing only |
| `npm run dev:platform` | Platform only |
| `npm run build` | Production build both apps |
| `npm run lint` | ESLint via `next lint` in each app |
| `npm run db:generate` | `prisma generate` |
| `npm run db:push` | Apply schema to DB (dev) |
| `npm run db:migrate` | Prisma migrate (when using migrations) |
| `npm run db:seed` | Run `prisma/seed.ts` |
| `npm run db:studio` | Prisma Studio |
| `npm run db:validate` | Validate `schema.prisma` (needs `DATABASE_URL`) |

## Repository layout

```text
apps/
  marketing-site/     # Public Next.js site
  platform-app/       # Authenticated SaaS (Prisma + Postgres)
packages/
  brand/ config/ types/ ui/ tsconfig/ eslint-config/
docs/
```

## Secrets & `.gitignore`

- **Never commit** `apps/**/.env` or other local env files. Only `**/.env.example` templates are tracked.
- See root `.gitignore` for Next.js, monorepo, Prisma, and Vercel patterns.

## Brand configuration

- Defaults: `packages/brand/src/config.ts`
- Optional public overrides: `apps/marketing-site/.env.example` (see `@anang/brand` env keys in source)

## License

Proprietary — All rights reserved.

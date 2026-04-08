# From code change to live web app (app.anang.ai)

Use this when you want a **change in Git** to show up on the **production** Anang Platform deployment (typically **app.anang.ai**). This path assumes you work in **Git + Vercel + Neon**, not a local dev server.

Build AI–specific details also live in [BUILD_AI_TESTING.md](./BUILD_AI_TESTING.md).

## How the pieces connect

1. **GitHub** holds the source. Nothing on the live site updates until Vercel builds a new deployment from a commit.
2. **Vercel** project **Anang Platform** (`apps/platform-app` root) builds on push (or manual redeploy) and runs `next build`.
3. **Neon** holds the database. Schema changes need **`prisma migrate deploy`**. Some features need **data** scripts (e.g. synthetic fee derivation) against the **same** `DATABASE_URL` the live app uses.

Environment variables for Production are set in **Vercel → Project → Settings → Environment Variables** (Production). They must match what the code expects (names and values).

---

## End-to-end checklist

### A. Make the change in the repo

- Edit code (or pull someone else’s branch and merge to `main` when ready).
- Do **not** commit secrets (no `.env`, `.env.neon`, API keys). Templates like `.env.example` are fine.

### B. Commit and push to GitHub

From the **repository root** (monorepo):

```bash
git status
git add <files-or-paths>
git commit -m "Describe the change clearly"
git push origin main
```

Use your real branch name if Production tracks something other than `main`.

Wait until **Vercel** shows a new deployment for that commit and it finishes with **Ready** (not Error).

### C. Database (only when needed)

Run these **only if** this release needs schema or synthetic data updates on **production Neon**. They use whatever `DATABASE_URL` Prisma loads (often from `apps/platform-app/.env` on your machine—ensure it points at **production Neon**, not a throwaway DB).

From **`apps/platform-app`**:

```bash
cd apps/platform-app
npx prisma migrate deploy
```

If you use Build AI synthetic fees and imported lines exist, refresh fee rows when you need them (safe to re-run; it rebuilds rates for the synthetic schedule):

```bash
npx tsx prisma/derive-synthetic-fee-schedule.ts
```

You previously used the npm script with Neon env; equivalent when `DATABASE_URL` is set:

```bash
npm run db:derive:synthetic-fees:neon
```

- **`migrate deploy`**: apply pending migrations. “No pending migrations” means the DB is already at the latest schema.
- **Derive script**: repopulates **`FeeScheduleRate`** from **`IMPORTED`** claim draft lines per tenant. It does not deploy UI.

### D. Vercel Production

1. **Automatic:** pushing to the connected branch usually triggers a build.
2. **If you changed env vars** in Vercel after the last build: open the latest deployment → **⋯** → **Redeploy** so new variables apply.
3. Confirm **Settings → Environment Variables** includes Production for names the feature needs (e.g. `BUILD_AI_TESTING_ENABLED`, `OPENAI_API_KEY`, `DATABASE_URL`).

### E. Verify on the live site

1. Open **https://app.anang.ai** (or your Production domain).
2. Hard refresh or use a private window.
3. Go to the relevant surface (e.g. **Build**: `/o/<org-slug>/build`).
4. Confirm the deployment’s **commit** in Vercel matches the commit you pushed (Deployments → deployment → Source).

If the UI still looks old, almost always **Production is serving an older deployment** or the **wrong Git branch** is connected.

---

## One-line summary

**Live UI = Git push → Vercel build succeeds → (optional) DB migrate/derive on Neon → redeploy if env changed → open app.anang.ai.**

There is no separate “publish command” beyond Git + Vercel; Prisma commands only affect the database, not HTML.

---

## Related

- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel root directory, install command, domains.
- [BUILD_AI_TESTING.md](./BUILD_AI_TESTING.md) — Build AI behavior, env names, UI locations.
- [BUILD_MODULE_WORKFLOW.md](./BUILD_MODULE_WORKFLOW.md) — recommended Build queue → encounter → approve order.

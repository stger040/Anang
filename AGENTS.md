# Repository instructions for AI coding agents

**Company:** Anang — https://anang.ai

Before changing product behavior or adding features, read **`docs/PLATFORM_OVERVIEW.md`** — it explains the full platform shape, modules, Cedar benchmark, and document map.

**Apps:**

- **`apps/marketing-site`** — public marketing (`anang.ai`).
- **`apps/platform-app`** — multi-tenant product (`app.anang.ai`), Prisma + PostgreSQL, routes under `/o/[orgSlug]/…` and super-admin `/admin`.

**Conventions:**

- **Customer-facing strings:** edit **`packages/brand/src/config.ts`** or env vars documented in **`docs/DEPLOYMENT.md`** / **`apps/marketing-site/.env.example`** — avoid hardcoding “Anang” across the app.
- **`@anang/types` module keys** must stay aligned with **`apps/platform-app/prisma/schema.prisma`** enums.
- **Deep plan:** `IMPLEMENTATION_PLAN.md` · **Process:** `BUILD_PLAN.md`

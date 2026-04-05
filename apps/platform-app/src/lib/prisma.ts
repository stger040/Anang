import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prismaPrimary?: PrismaClient;
  prismaByUrl?: Map<string, PrismaClient>;
};

/** Env key: slug `synthetic-test` → `DATABASE_URL__SYNTHETIC_TEST` */
export function tenantDatabaseEnvKey(slug: string): string {
  return `DATABASE_URL__${slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
}

/**
 * Connection string for tenant-scoped app routes. Falls back to `DATABASE_URL`.
 * When `DATABASE_URL__<SLUG>` is set, that Postgres must contain the **same Prisma schema**
 * and consistent `Tenant` / FK rows for that org (or be the only DB you use for that deploy).
 */
export function resolveTenantDatabaseUrl(
  tenantSlug: string | null | undefined,
): string {
  const primary = process.env.DATABASE_URL?.trim();
  if (!primary) {
    throw new Error("DATABASE_URL is not set");
  }
  const slug = tenantSlug?.trim();
  if (!slug) return primary;
  const override = process.env[tenantDatabaseEnvKey(slug)]?.trim();
  if (override) return override;
  return primary;
}

function clientsByUrl(): Map<string, PrismaClient> {
  if (!globalForPrisma.prismaByUrl) {
    globalForPrisma.prismaByUrl = new Map();
  }
  return globalForPrisma.prismaByUrl;
}

function getOrCreateClient(url: string): PrismaClient {
  const map = clientsByUrl();
  let c = map.get(url);
  if (!c) {
    c = new PrismaClient({
      datasourceUrl: url,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
    map.set(url, c);
  }
  return c;
}

/**
 * Default client: **`DATABASE_URL` only** (auth, `/admin`, `/post-signin`, cron, webhooks).
 */
export const prisma =
  globalForPrisma.prismaPrimary ??
  getOrCreateClient(resolveTenantDatabaseUrl(null));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaPrimary = prisma;
}

/**
 * **Staff workspace** (`/o/[orgSlug]`) and **patient portal** (`/p/[orgSlug]`).
 * Uses optional `DATABASE_URL__<SLUG>` when set.
 */
export function tenantPrisma(orgSlug: string): PrismaClient {
  return getOrCreateClient(resolveTenantDatabaseUrl(orgSlug));
}

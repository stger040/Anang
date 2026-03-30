import type { ModuleKey } from "@prisma/client";
import { notFound } from "next/navigation";
import { loadTenantNav } from "@/lib/tenant-context";

/** Per-module layouts call this to enforce entitlements (extra DB read; swap for cached context later). */
export async function requireModule(orgSlug: string, module: ModuleKey) {
  const ctx = await loadTenantNav(orgSlug);
  if (!ctx?.enabledModules.has(module)) notFound();
}

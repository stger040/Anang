import type { ModuleKey } from "@prisma/client";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { assertOrgAccess, loadTenantNav } from "@/lib/tenant-context";

/** Tenant-only check (no session): scripts, health, or legacy callers. */
export async function requireModule(orgSlug: string, module: ModuleKey) {
  const ctx = await loadTenantNav(orgSlug);
  if (!ctx?.enabledModules.has(module)) notFound();
}

/**
 * Staff workspace: session required (parent `/o` layout already redirects unauthenticated users).
 * Enforces tenant entitlement **and** per-staff `staffModuleAllowList` when set.
 */
export async function requireModuleForSession(orgSlug: string, module: ModuleKey) {
  const session = await getSession();
  if (!session) notFound();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(module)) notFound();
}

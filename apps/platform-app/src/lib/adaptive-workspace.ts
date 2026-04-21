import { ModuleKey } from "@prisma/client";
import { unlockAllModulesForTesting } from "@/lib/auth-config";
import type { SessionPayload } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";

/** Staff-facing modules that map to sidebar destinations (excludes CORE). */
const OPERATIONAL_ORDER: ModuleKey[] = [
  ModuleKey.BUILD,
  ModuleKey.CONNECT,
  ModuleKey.PAY,
  ModuleKey.SUPPORT,
  ModuleKey.COVER,
  ModuleKey.INSIGHT,
];

export const DEMO_TENANT_SLUG = "synthetic-test";

export function operationalEffectiveModules(
  effective: Set<ModuleKey> | ReadonlySet<ModuleKey>,
): ModuleKey[] {
  return OPERATIONAL_ORDER.filter((m) => effective.has(m));
}

export function moduleHomePath(orgSlug: string, m: ModuleKey): string {
  const base = `/o/${orgSlug}`;
  switch (m) {
    case ModuleKey.BUILD:
      return `${base}/build`;
    case ModuleKey.CONNECT:
      return `${base}/connect`;
    case ModuleKey.PAY:
      return `${base}/pay`;
    case ModuleKey.SUPPORT:
      return `${base}/support`;
    case ModuleKey.COVER:
      return `${base}/cover`;
    case ModuleKey.INSIGHT:
      return `${base}/insight`;
    default:
      return `${base}/dashboard`;
  }
}

/**
 * Full connected “Start here” dashboard (multi-module demo story).
 * Broad access: many operational modules, or demo tenant with strong coverage,
 * or local unlock-all testing.
 */
export function useFullSuiteDashboard(
  operational: ModuleKey[],
  orgSlug: string,
): boolean {
  if (unlockAllModulesForTesting()) return true;
  if (operational.length >= 5) return true;
  if (orgSlug === DEMO_TENANT_SLUG && operational.length >= 4) return true;
  return false;
}

/** Compact workspace: a few modules, not the full-suite story. */
export function useCompactWorkspace(operational: ModuleKey[]): boolean {
  return operational.length >= 2 && operational.length <= 3;
}

export function adaptiveTenantEntryPath(
  orgSlug: string,
  effective: Set<ModuleKey>,
): string {
  const ops = operationalEffectiveModules(effective);
  if (ops.length === 1) {
    return moduleHomePath(orgSlug, ops[0]!);
  }
  return `/o/${orgSlug}/dashboard`;
}

/** Used after sign-in / invite to land on the right first screen for this user. */
export async function postSignInTenantPath(
  session: SessionPayload,
  orgSlug: string,
): Promise<string> {
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return `/o/${orgSlug}/dashboard`;
  return adaptiveTenantEntryPath(orgSlug, ctx.effectiveModules);
}

export const MODULE_PLAIN_NAME: Record<
  ModuleKey,
  string
> = {
  CORE: "Core",
  BUILD: "Build",
  CONNECT: "Connect",
  PAY: "Pay",
  INSIGHT: "Insight",
  SUPPORT: "Support",
  COVER: "Cover",
};

import {
  isFullSuiteDashboardMode,
  operationalEffectiveModules,
} from "@/lib/adaptive-workspace";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { type ModuleKey } from "@prisma/client";

/** Shared server context for tenant module pages (landing + cross-module hints). */
export async function loadTenantWorkspacePageContext(
  orgSlug: string,
  requiredModule?: ModuleKey,
) {
  const session = await getSession();
  if (!session) return null;
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return null;
  if (requiredModule && !ctx.effectiveModules.has(requiredModule)) return null;
  const operational = operationalEffectiveModules(ctx.effectiveModules);
  const fullSuiteDashboard = isFullSuiteDashboardMode(operational, orgSlug);
  return { session, ctx, operational, fullSuiteDashboard };
}

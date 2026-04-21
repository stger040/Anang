import {
  isFullSuiteDashboardMode,
  operationalEffectiveModules,
} from "@/lib/adaptive-workspace";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";

/** Shared server context for tenant module pages (landing + cross-module hints). */
export async function loadTenantWorkspacePageContext(orgSlug: string) {
  const session = await getSession();
  if (!session) return null;
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return null;
  const operational = operationalEffectiveModules(ctx.effectiveModules);
  const fullSuiteDashboard = isFullSuiteDashboardMode(operational, orgSlug);
  return { session, ctx, operational, fullSuiteDashboard };
}

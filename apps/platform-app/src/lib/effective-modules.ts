import { AppRole, type ModuleKey } from "@prisma/client";
import type { SessionPayload } from "@/lib/session";

/**
 * Operational modules the signed-in user may use in this tenant: tenant entitlements intersected
 * with optional STAFF allow-list. TENANT_ADMIN and SUPER_ADMIN get full tenant entitlements.
 */
export function computeEffectiveModules(
  session: SessionPayload,
  tenantEnabled: Set<ModuleKey>,
  membership: {
    role: AppRole;
    staffModuleAllowList: ModuleKey[];
  } | null,
): Set<ModuleKey> {
  if (session.appRole === AppRole.SUPER_ADMIN) {
    return new Set(tenantEnabled);
  }
  if (!membership) return new Set();
  if (membership.role === AppRole.TENANT_ADMIN) {
    return new Set(tenantEnabled);
  }
  const list = membership.staffModuleAllowList;
  if (!list.length) return new Set(tenantEnabled);
  const allow = new Set(list);
  const out = new Set<ModuleKey>();
  for (const m of tenantEnabled) {
    if (allow.has(m)) out.add(m);
  }
  return out;
}

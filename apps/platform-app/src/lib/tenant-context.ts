import { AppRole, ModuleKey } from "@prisma/client";
import { unlockAllModulesForTesting } from "@/lib/auth-config";
import { computeEffectiveModules } from "@/lib/effective-modules";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/session";

function allEntitledModuleKeys(): Set<ModuleKey> {
  return new Set(Object.values(ModuleKey) as ModuleKey[]);
}

export type TenantNavContext = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    displayName: string;
    primaryColor: string;
    logoUrl: string | null;
  };
  enabledModules: Set<ModuleKey>;
};

/** Tenant workspace access after session + org checks. Includes membership role when applicable. */
export type OrgAccessContext = TenantNavContext & {
  /**
   * `Membership.role` for this tenant, if a row exists.
   * Platform super-admins may have no membership; value is null in that case.
   */
  membershipRole: AppRole | null;
  /**
   * Modules this session may use in this org (nav + server checks). Subset of `enabledModules` for restricted staff.
   */
  effectiveModules: Set<ModuleKey>;
};

export async function loadTenantNav(
  orgSlug: string,
): Promise<TenantNavContext | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    include: {
      moduleEntitlements: true,
    },
  });
  if (!tenant) return null;
  const enabledModules = unlockAllModulesForTesting()
    ? allEntitledModuleKeys()
    : (() => {
        const set = new Set<ModuleKey>();
        for (const e of tenant.moduleEntitlements) {
          if (e.enabled) set.add(e.module);
        }
        return set;
      })();
  return {
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      displayName: tenant.displayName,
      primaryColor: tenant.primaryColor,
      logoUrl: tenant.logoUrl,
    },
    enabledModules,
  };
}

export async function assertOrgAccess(
  session: SessionPayload,
  orgSlug: string,
): Promise<OrgAccessContext | null> {
  const ctx = await loadTenantNav(orgSlug);
  if (!ctx) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.userId, tenantId: ctx.tenant.id },
  });

  if (session.appRole === AppRole.SUPER_ADMIN) {
    const membershipRole = membership?.role ?? null;
    const effectiveModules = unlockAllModulesForTesting()
      ? allEntitledModuleKeys()
      : computeEffectiveModules(session, ctx.enabledModules, membership);
    return { ...ctx, membershipRole, effectiveModules };
  }
  if (!membership) return null;
  const effectiveModules = unlockAllModulesForTesting()
    ? allEntitledModuleKeys()
    : computeEffectiveModules(session, ctx.enabledModules, membership);
  return {
    ...ctx,
    membershipRole: membership.role,
    effectiveModules,
  };
}

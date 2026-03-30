import { AppRole, type ModuleKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DemoSessionPayload } from "@/lib/session";

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
  const enabledModules = new Set<ModuleKey>();
  for (const e of tenant.moduleEntitlements) {
    if (e.enabled) enabledModules.add(e.module);
  }
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
  session: DemoSessionPayload,
  orgSlug: string,
): Promise<TenantNavContext | null> {
  const ctx = await loadTenantNav(orgSlug);
  if (!ctx) return null;
  if (session.appRole === AppRole.SUPER_ADMIN) return ctx;
  const m = await prisma.membership.findFirst({
    where: { userId: session.userId, tenantId: ctx.tenant.id },
  });
  if (!m) return null;
  return ctx;
}

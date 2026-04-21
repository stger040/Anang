import { PlatformShell } from "@/components/platform-shell";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import {
  emitSuperAdminCrossTenantAccess,
  readSupportAccessContextFromHeaders,
} from "@/lib/super-admin-org-audit";
import {
  operationalEffectiveModules,
  useFullSuiteDashboard,
} from "@/lib/adaptive-workspace";
import { canAccessTenantAdminRoutes } from "@/lib/tenant-admin-guard";
import { assertOrgAccess } from "@/lib/tenant-context";
import { AppRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  const showTenantAdminNav = canAccessTenantAdminRoutes(
    session,
    ctx.membershipRole,
  );

  const operational = operationalEffectiveModules(ctx.effectiveModules);
  const fullSuiteDashboard = useFullSuiteDashboard(operational, orgSlug);
  const showDashboardInNav = operational.length !== 1;
  const dashboardNavLabel = fullSuiteDashboard ? "Start Here" : "Home";
  const dashboardNavShortHelp = fullSuiteDashboard
    ? "Guided demo flow"
    : "Your workspace overview";

  if (
    session.appRole === AppRole.SUPER_ADMIN &&
    ctx.membershipRole === null
  ) {
    const requestId = await readRequestIdFromHeaders();
    const supportContext = await readSupportAccessContextFromHeaders();
    await emitSuperAdminCrossTenantAccess({
      userId: session.userId,
      tenantId: ctx.tenant.id,
      orgSlug,
      ...(requestId ? { requestId } : {}),
      ...(supportContext ? { supportContext } : {}),
    });
  }

  return (
    <PlatformShell
      orgSlug={orgSlug}
      tenantName={ctx.tenant.displayName}
      enabledModules={Array.from(ctx.effectiveModules)}
      showTenantAdminNav={showTenantAdminNav}
      userEmail={session.email}
      showDashboardInNav={showDashboardInNav}
      dashboardNavLabel={dashboardNavLabel}
      dashboardNavShortHelp={dashboardNavShortHelp}
    >
      {children}
    </PlatformShell>
  );
}

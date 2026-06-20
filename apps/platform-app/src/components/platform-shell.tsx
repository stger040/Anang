import { TenantWorkspace } from "@/components/tenant-workspace";
import type { ModuleKey } from "@prisma/client";

export function PlatformShell({
  orgSlug,
  tenantName,
  enabledModules,
  showTenantAdminNav,
  userEmail,
  extraTopActions,
  showDashboardInNav = true,
  children,
}: {
  orgSlug: string;
  tenantName: string;
  enabledModules: ModuleKey[];
  showTenantAdminNav: boolean;
  userEmail: string;
  extraTopActions?: React.ReactNode;
  showDashboardInNav?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TenantWorkspace
      orgSlug={orgSlug}
      tenantName={tenantName}
      enabledModules={enabledModules}
      showTenantAdminNav={showTenantAdminNav}
      userEmail={userEmail}
      extraTopActions={extraTopActions}
      showDashboardInNav={showDashboardInNav}
    >
      {children}
    </TenantWorkspace>
  );
}

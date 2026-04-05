import { TenantWorkspace } from "@/components/tenant-workspace";
import type { ModuleKey } from "@prisma/client";

export function PlatformShell({
  orgSlug,
  tenantName,
  enabledModules,
  showTenantAdminNav,
  userEmail,
  extraTopActions,
  children,
}: {
  orgSlug: string;
  tenantName: string;
  enabledModules: ModuleKey[];
  /** Org-level Admin rail (`/settings`): tenant admins + platform super-admins only. */
  showTenantAdminNav: boolean;
  userEmail: string;
  extraTopActions?: React.ReactNode;
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
    >
      {children}
    </TenantWorkspace>
  );
}

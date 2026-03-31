import { TenantWorkspace } from "@/components/tenant-workspace";
import type { ModuleKey } from "@prisma/client";

export function PlatformShell({
  orgSlug,
  tenantName,
  enabledModules,
  userEmail,
  extraTopActions,
  children,
}: {
  orgSlug: string;
  tenantName: string;
  enabledModules: ModuleKey[];
  userEmail: string;
  extraTopActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TenantWorkspace
      orgSlug={orgSlug}
      tenantName={tenantName}
      enabledModules={enabledModules}
      userEmail={userEmail}
      extraTopActions={extraTopActions}
    >
      {children}
    </TenantWorkspace>
  );
}

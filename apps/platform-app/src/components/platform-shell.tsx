import { AppSidebar } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { TopBar } from "@/components/top-bar";
import type { ModuleKey } from "@prisma/client";

export function PlatformShell({
  orgSlug,
  tenantName,
  enabledModules,
  suiteName,
  userEmail,
  extraTopActions,
  children,
}: {
  orgSlug: string;
  tenantName: string;
  enabledModules: ModuleKey[];
  suiteName: string;
  userEmail: string;
  extraTopActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar
        orgSlug={orgSlug}
        enabledModules={enabledModules}
        tenantName={tenantName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          suiteName={suiteName}
          orgLabel={tenantName}
          userEmail={userEmail}
          actions={
            <>
              {extraTopActions}
              <SignOutButton />
            </>
          }
        />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

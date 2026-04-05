"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { SignOutButton } from "@/components/sign-out-button";
import { TopBar } from "@/components/top-bar";
import type { ModuleKey } from "@prisma/client";
import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "anang-sidebar-collapsed";
const COLLAPSED_WIDTH_PX = 56;
const MIN_EXPANDED_WIDTH_PX = 220;
const MAX_EXPANDED_WIDTH_PX = 420;

/**
 * Expanded-rail width from tenant title length (roughly fits the name + nav labels).
 * Top-bar offset to `#topbar-org-block` is dominated by logo width and unrelated to rail width
 * in a stable way, so we avoid a feedback loop and size from copy length instead.
 */
function widthForTenantName(name: string): number {
  const raw = Math.round(name.trim().length * 8.5 + 72);
  return Math.min(
    MAX_EXPANDED_WIDTH_PX,
    Math.max(MIN_EXPANDED_WIDTH_PX, raw),
  );
}

export function TenantWorkspace({
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
  showTenantAdminNav: boolean;
  userEmail: string;
  extraTopActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [expandedWidthPx, setExpandedWidthPx] = useState(() =>
    widthForTenantName(tenantName),
  );

  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    else if (stored === "0") setCollapsed(false);
    else setCollapsed(window.innerWidth < 768);
  }, []);

  useLayoutEffect(() => {
    setExpandedWidthPx(widthForTenantName(tenantName));
  }, [tenantName]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH_PX : expandedWidthPx;

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        orgSlug={orgSlug}
        enabledModules={enabledModules}
        showTenantAdminNav={showTenantAdminNav}
        tenantName={tenantName}
        widthPx={sidebarWidth}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
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

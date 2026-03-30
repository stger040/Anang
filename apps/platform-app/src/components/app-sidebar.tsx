"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleKey } from "@prisma/client";

export type NavItem = {
  href: string;
  label: string;
  module?: ModuleKey;
  icon: string;
};

const ALL: NavItem[] = [
  { href: "dashboard", label: "Overview", icon: "◆", module: undefined },
  { href: "build", label: "Build", icon: "▣", module: "BUILD" },
  { href: "pay", label: "Pay", icon: "$", module: "PAY" },
  { href: "connect", label: "Connect", icon: "⇄", module: "CONNECT" },
  { href: "insight", label: "Insight", icon: "◇", module: "INSIGHT" },
  { href: "support", label: "Support", icon: "☰", module: "SUPPORT" },
  { href: "cover", label: "Cover", icon: "◎", module: "COVER" },
  { href: "settings", label: "Admin", icon: "⚙", module: undefined },
];

export function AppSidebar({
  orgSlug,
  enabledModules,
  tenantName,
}: {
  orgSlug: string;
  enabledModules: ModuleKey[];
  tenantName: string;
}) {
  const pathname = usePathname();
  const enabled = new Set(enabledModules);

  const items = ALL.filter((n) => {
    if (!n.module) return true;
    return enabled.has(n.module);
  });

  const base = `/o/${orgSlug}`;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Organization
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">
          {tenantName}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
          /{orgSlug}
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map((n) => {
          const full = `${base}/${n.href}`;
          const active = pathname === full || pathname.startsWith(`${full}/`);
          return (
            <Link
              key={n.href}
              href={full}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-teal-50 text-teal-900"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="w-5 text-center text-xs opacity-70">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-3 text-xs text-slate-400">
        Synthetic demo data · not PHI
      </div>
    </aside>
  );
}

"use client";

import {
  abbrevOrgDisplayName,
  abbrevOrgSlugForSidebar,
} from "@/lib/org-abbrev";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ModuleKey } from "@prisma/client";
import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  module?: ModuleKey;
  icon: ReactNode;
  iconTone: string;
};

/** Wider three-bar rail icon (+1px line length vs typical ☰ glyph in this slot). */
function SupportRailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 14"
      width="20"
      height="14"
      className={className}
      aria-hidden
    >
      <line
        x1="1"
        y1="3.5"
        x2="19"
        y2="3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="7"
        x2="19"
        y2="7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="10.5"
        x2="19"
        y2="10.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ALL: NavItem[] = [
  {
    href: "dashboard",
    label: "Overview",
    icon: <span className="text-base">◆</span>,
    module: undefined,
    iconTone: "text-purple-600",
  },
  {
    href: "build",
    label: "Build",
    icon: <span className="text-base">▣</span>,
    module: "BUILD",
    iconTone: "text-blue-600",
  },
  {
    href: "pay",
    label: "Pay",
    icon: <span className="text-base">$</span>,
    module: "PAY",
    iconTone: "text-green-600",
  },
  {
    href: "connect",
    label: "Connect",
    icon: <span className="text-base">⇄</span>,
    module: "CONNECT",
    iconTone: "text-red-600",
  },
  {
    href: "insight",
    label: "Insight",
    icon: <span className="text-base">◇</span>,
    module: "INSIGHT",
    iconTone: "text-emerald-800",
  },
  {
    href: "support",
    label: "Support",
    icon: <SupportRailIcon />,
    module: "SUPPORT",
    iconTone: "text-violet-900",
  },
  {
    href: "cover",
    label: "Cover",
    icon: <span className="text-base">◎</span>,
    module: "COVER",
    iconTone: "text-orange-600",
  },
  {
    href: "settings",
    label: "Admin",
    icon: <span className="text-base">⚙</span>,
    module: undefined,
    iconTone: "text-slate-500",
  },
];

export function AppSidebar({
  orgSlug,
  enabledModules,
  tenantName,
  widthPx,
  collapsed,
  onToggleCollapsed,
}: {
  orgSlug: string;
  enabledModules: ModuleKey[];
  tenantName: string;
  widthPx: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();
  const enabled = new Set(enabledModules);
  const orgAbbrev = abbrevOrgDisplayName(tenantName);
  const slugAbbrev = abbrevOrgSlugForSidebar(orgSlug);

  const items = ALL.filter((n) => {
    if (!n.module) return true;
    return enabled.has(n.module);
  });

  const base = `/o/${orgSlug}`;

  return (
    <aside
      id="tenant-sidebar"
      className="flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-300 ease-out"
      style={{ width: widthPx }}
    >
      <div
        className={`border-b border-slate-200 py-2.5 sm:py-3 ${collapsed ? "px-1" : "px-4 sm:px-6"}`}
      >
        <div
          className={`relative ${collapsed ? "min-h-[3rem] overflow-visible" : "min-h-[3.25rem] overflow-hidden"}`}
        >
          <div
            className={`transition-all duration-300 ease-out ${
              collapsed
                ? "pointer-events-none translate-y-1 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            <p className="truncate text-sm font-semibold text-slate-900">
              {tenantName}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
              /{orgSlug}
            </p>
          </div>
          <div
            className={`absolute inset-0 flex flex-col justify-center text-center transition-all duration-300 ease-out ${
              collapsed
                ? "translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0"
            }`}
          >
            <p
              className="whitespace-nowrap text-xs font-bold leading-tight tracking-tight text-slate-900 sm:text-sm"
              title={tenantName}
            >
              {orgAbbrev || "—"}
            </p>
            <p
              className="mt-0.5 whitespace-nowrap font-mono text-[11px] leading-none text-slate-500"
              title={`/${orgSlug}`}
            >
              {slugAbbrev}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 p-1.5">
        {items.map((n) => {
          const full = `${base}/${n.href}`;
          const active = pathname === full || pathname.startsWith(`${full}/`);
          return (
            <Link
              key={n.href}
              href={full}
              title={n.label}
              className={`flex items-center gap-2 overflow-hidden rounded-lg py-2 text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-1" : "px-2"
              } ${
                active
                  ? "bg-brand-sky/90 text-brand-navy"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center leading-none ${n.iconTone}`}
              >
                {n.icon}
              </span>
              <span
                className={`whitespace-nowrap transition-all duration-300 ease-out ${
                  collapsed
                    ? "max-w-0 translate-x-2 opacity-0"
                    : "max-w-[12rem] translate-x-0 opacity-100"
                }`}
              >
                {n.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`flex w-full items-center py-2.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 ${
            collapsed ? "justify-center px-0" : "justify-start gap-2 px-3"
          }`}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar (full labels)" : "Collapse sidebar (icons only)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0 text-slate-400 transition-transform duration-300 ease-out"
            style={{ transform: collapsed ? "rotate(180deg)" : "none" }}
            aria-hidden
          >
            <path
              d="M15 6L9 12l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            className={`overflow-hidden transition-all duration-300 ease-out ${
              collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100"
            }`}
          >
            Narrow rail
          </span>
        </button>
        <div
          className={`border-t border-slate-100 px-2 py-2 text-[10px] leading-snug text-slate-400 transition-opacity duration-300 ${
            collapsed ? "hidden" : "block"
          }`}
        >
          Synthetic demo data · not PHI
        </div>
      </div>
    </aside>
  );
}

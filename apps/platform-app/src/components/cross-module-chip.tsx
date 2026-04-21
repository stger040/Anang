import { moduleHomePath, MODULE_PLAIN_NAME } from "@/lib/adaptive-workspace";
import type { ModuleKey } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

function toSet(modules: ReadonlySet<ModuleKey> | ModuleKey[]): Set<ModuleKey> {
  return modules instanceof Set ? new Set(modules) : new Set(modules);
}

/**
 * Pill that links to another module when the user has access; otherwise explains
 * where that work lives without implying broken navigation.
 */
export function CrossModuleChip({
  orgSlug,
  targetModule,
  effectiveModules,
  hrefWhenAllowed,
  emphasis,
  children,
}: {
  orgSlug: string;
  targetModule: ModuleKey;
  effectiveModules: ReadonlySet<ModuleKey> | ModuleKey[];
  /** Deep link when allowed (defaults to module home). */
  hrefWhenAllowed?: string;
  emphasis?: boolean;
  children: ReactNode;
}) {
  const allowed = toSet(effectiveModules).has(targetModule);
  const href = hrefWhenAllowed ?? moduleHomePath(orgSlug, targetModule);
  const base =
    "inline-flex max-w-full items-center rounded-full border px-2 py-1 text-xs leading-snug transition-colors";
  if (allowed) {
    return (
      <Link
        href={href}
        className={`${base} ${
          emphasis
            ? "border-brand-sky/50 bg-brand-sky/30 font-medium text-brand-navy hover:bg-brand-sky/40"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        {children}
      </Link>
    );
  }
  const name = MODULE_PLAIN_NAME[targetModule];
  return (
    <span
      className={`${base} cursor-default border-dashed border-slate-200 bg-slate-50 text-slate-600`}
      title={`${name} is a separate workspace in this product. Ask an admin if you need access.`}
    >
      <span className="font-medium text-slate-700">{name}:</span>
      <span className="ml-1">
        handled in {name} — not in your current access set
      </span>
    </span>
  );
}

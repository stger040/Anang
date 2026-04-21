import { MODULE_PLAIN_NAME } from "@/lib/adaptive-workspace";
import { Button } from "@anang/ui";
import type { ModuleKey } from "@prisma/client";
import Link from "next/link";
import type { ReactNode } from "react";

function toSet(modules: ReadonlySet<ModuleKey> | ModuleKey[]): Set<ModuleKey> {
  return modules instanceof Set ? new Set(modules) : new Set(modules);
}

/** Primary/secondary CTA to another module, or a neutral handoff when access is missing. */
export function CrossModuleActionRow({
  module,
  effectiveModules,
  href,
  variant = "secondary",
  children,
}: {
  module: ModuleKey;
  effectiveModules: ReadonlySet<ModuleKey> | ModuleKey[];
  href: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const allowed = toSet(effectiveModules).has(module);
  const name = MODULE_PLAIN_NAME[module];
  if (allowed) {
    return (
      <Link href={href}>
        <Button type="button" variant={variant} size="sm">
          {children}
        </Button>
      </Link>
    );
  }
  return (
    <div className="max-w-md rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-left text-xs leading-snug text-slate-600">
      <span className="font-semibold text-slate-800">{name}:</span> this step
      runs in {name} for your organization. You do not have that module in your
      access set — ask a tenant admin if you need it here.
    </div>
  );
}

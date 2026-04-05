"use client";

import { ModuleKey } from "@prisma/client";

const OPTIONS: { module: ModuleKey; label: string }[] = [
  { module: ModuleKey.BUILD, label: "Build" },
  { module: ModuleKey.PAY, label: "Pay" },
  { module: ModuleKey.CONNECT, label: "Connect" },
  { module: ModuleKey.INSIGHT, label: "Insight" },
  { module: ModuleKey.SUPPORT, label: "Support" },
  { module: ModuleKey.COVER, label: "Cover" },
];

/** Unchecked = full access to all modules the tenant has enabled (typical). */
export function StaffModuleCheckboxes({
  idPrefix,
  /** When non-empty, those boxes start checked (persisted restriction). Empty = all unchecked (full access). */
  defaultSelected = [],
}: {
  idPrefix: string;
  defaultSelected?: ModuleKey[];
}) {
  const selected = new Set(defaultSelected);
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:col-span-2">
      <legend className="px-1 text-xs font-medium text-slate-800">
        Staff module access (optional)
      </legend>
      <p className="mt-2 text-xs text-slate-600">
        Leave all unchecked so this staff user can use every module the tenant has
        purchased. Select a subset to restrict (e.g. frontline support: Pay, Cover,
        Support only).
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-800">
        {OPTIONS.map(({ module, label }) => (
          <label key={module} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              name="staffModule"
              value={module}
              id={`${idPrefix}-mod-${module}`}
              className="border-slate-300"
              defaultChecked={selected.size > 0 && selected.has(module)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

"use client";

import { Button } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";

import { createTenant, type AdminActionState } from "../../actions";

const OPTIONAL_MODULES = Object.values(ModuleKey).filter(
  (m) => m !== ModuleKey.CORE,
);

export function TenantNewForm() {
  const [state, formAction, pending] = useActionState<
    AdminActionState,
    FormData
  >(createTenant, null);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="slug"
            className="block text-xs font-medium text-slate-700"
          >
            URL slug
          </label>
          <p className="mt-0.5 text-xs text-slate-500">
            Workspace URL: /o/<span className="font-mono">slug</span>/…
          </p>
          <input
            id="slug"
            name="slug"
            required
            placeholder="acme-health"
            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="block text-xs font-medium text-slate-700"
          >
            Legal / internal name
          </label>
          <input
            id="name"
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-slate-700"
          >
            Display name
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="primaryColor"
            className="block text-xs font-medium text-slate-700"
          >
            Primary color (#RRGGBB, optional)
          </label>
          <input
            id="primaryColor"
            name="primaryColor"
            placeholder="#0f766e"
            className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-700">Modules</p>
        <p className="mt-1 text-xs text-slate-500">
          <span className="font-mono">CORE</span> is always enabled (settings,
          user list).
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {OPTIONAL_MODULES.map((m) => (
            <li key={m}>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input type="checkbox" name="module" value={m} className="rounded border-slate-300" />
                <span className="font-mono text-xs">{m}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create tenant"}
        </Button>
        <Link
          href="/admin"
          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

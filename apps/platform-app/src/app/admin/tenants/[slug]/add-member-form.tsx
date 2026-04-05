"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef, useState } from "react";

import { addTenantMember, type AddMemberState } from "../../actions";
import { StaffModuleCheckboxes } from "../staff-module-checkboxes";

export function AddMemberForm({ slug }: { slug: string }) {
  const [tenantRole, setTenantRole] = useState<"TENANT_ADMIN" | "STAFF">(
    "TENANT_ADMIN",
  );
  const [state, formAction, pending] = useActionState<AddMemberState, FormData>(
    addTenantMember,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`add-email-${slug}`}
            className="block text-xs font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id={`add-email-${slug}`}
            name="email"
            type="email"
            required
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label
            htmlFor={`add-name-${slug}`}
            className="block text-xs font-medium text-slate-700"
          >
            Name
          </label>
          <input
            id={`add-name-${slug}`}
            name="name"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div className="sm:col-span-2">
          <span className="block text-xs font-medium text-slate-700">
            Role (tenant)
          </span>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-800">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="membershipRole"
                value="TENANT_ADMIN"
                checked={tenantRole === "TENANT_ADMIN"}
                onChange={() => setTenantRole("TENANT_ADMIN")}
                className="border-slate-300"
              />
              Tenant admin (settings, users for this org)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="membershipRole"
                value="STAFF"
                checked={tenantRole === "STAFF"}
                onChange={() => setTenantRole("STAFF")}
                className="border-slate-300"
              />
              Staff
            </label>
          </div>
        </div>
        {tenantRole === "STAFF" ? (
          <StaffModuleCheckboxes idPrefix={`add-${slug}`} />
        ) : null}
      </div>

      {state?.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Member saved. They can sign in with this email and your staging
          platform password (until SSO is enabled).
        </p>
      ) : null}

      <Button type="submit" disabled={pending} variant="secondary" size="sm">
        {pending ? "Saving…" : "Add or update member"}
      </Button>
    </form>
  );
}

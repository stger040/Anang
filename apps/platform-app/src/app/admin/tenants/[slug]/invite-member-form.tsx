"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef, useState } from "react";

import {
  createTenantInvite,
  type CreateInviteState,
} from "../../actions";
import { StaffModuleCheckboxes } from "../staff-module-checkboxes";

export function InviteMemberForm({ slug }: { slug: string }) {
  const [tenantRole, setTenantRole] = useState<"TENANT_ADMIN" | "STAFF">(
    "TENANT_ADMIN",
  );
  const [state, formAction, pending] = useActionState<
    CreateInviteState,
    FormData
  >(createTenantInvite, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (state && "ok" in state && state.ok) formRef.current?.reset();
  }, [state]);

  const success =
    state && "ok" in state && state.ok
      ? {
          inviteUrl: state.inviteUrl,
          emailDelivery: state.emailDelivery,
          emailDeliveryDetail: state.emailDeliveryDetail,
        }
      : null;

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <p className="text-xs text-slate-600">
        Generates a time-limited link. The invitee signs in with this exact email
        (SSO or password), then receives the membership below. Use{" "}
        <strong>Add or update member</strong> if they need an account before
        IdP login is ready.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor={`invite-email-${slug}`}
            className="block text-xs font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id={`invite-email-${slug}`}
            name="email"
            type="email"
            required
            autoComplete="off"
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
              Tenant admin
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
          <StaffModuleCheckboxes idPrefix={`invite-${slug}`} />
        ) : null}
      </div>

      {state && "error" in state && state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      {success ? (
        <div className="space-y-3">
          {success.emailDelivery === "sent" ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Invitation email sent to the address above.
            </p>
          ) : null}
          {success.emailDelivery === "skipped" ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Email not configured (
              <code className="font-mono text-xs">RESEND_API_KEY</code> or{" "}
              <code className="font-mono text-xs">SENDGRID_API_KEY</code>). Copy
              the link below or set env in{" "}
              <code className="font-mono text-xs">docs/DEPLOYMENT.md</code>.
            </p>
          ) : null}
          {success.emailDelivery === "failed" ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Email failed: {success.emailDeliveryDetail ?? "unknown error"}. Copy
              the link manually.
            </p>
          ) : null}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-medium">Invite link (copy once; not shown again)</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                readOnly
                value={success.inviteUrl}
                className="w-full rounded border border-emerald-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-900"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(success.inviteUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} variant="secondary" size="sm">
        {pending ? "Creating…" : "Create invite link"}
      </Button>
    </form>
  );
}

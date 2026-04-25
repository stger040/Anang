"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  BILLING_DISCOVERY_ITEMS,
  IT_EHR_WORKSTREAM_ITEMS,
} from "@/lib/onboarding-checklists";
import {
  DEFAULT_PRIOR_AUTH_HIGH_RISK,
  defaultPriorAuthImplementationSettings,
  type PriorAuthSignalCategoryKey,
} from "@/lib/prior-auth/defaults";
import type { TenantImplementationSettingsV1 } from "@/lib/tenant-implementation-settings";

import {
  saveImplementationProgress,
  type SettingsActionState,
} from "../actions";

const TP_PRESET_KEYS = new Set([
  "availity",
  "change_healthcare",
  "office_ally",
  "optum",
  "navicure",
  "emdeon",
]);

export function ImplementationForm({
  orgSlug,
  implementation,
  canEdit,
}: {
  orgSlug: string;
  implementation: TenantImplementationSettingsV1 | null;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(saveImplementationProgress, null);
  const bannerRef = useRef<HTMLParagraphElement>(null);

  const bill = implementation?.checklist?.billing ?? {};
  const it = implementation?.checklist?.it ?? {};
  const c = implementation?.contacts;
  const tp = implementation?.tradingPartnerEnrollment;
  const tpKey = tp?.clearinghouseKey ?? "";
  const tpClearinghouseSelect =
    !tpKey ? "" : TP_PRESET_KEYS.has(tpKey) ? tpKey : "other";
  const tpClearinghouseOtherDefault = TP_PRESET_KEYS.has(tpKey) ? "" : tpKey;

  const pa =
    implementation?.priorAuth ?? defaultPriorAuthImplementationSettings();
  const paCats = new Set(pa.defaultHighRiskCategories);
  const paCatLabels: Record<PriorAuthSignalCategoryKey, string> = {
    advanced_imaging: "Advanced imaging (CT / MRI / PET CPT bands)",
    outpatient_surgery_context: "Outpatient surgery / ASC context (POS 22 or procedure shortlist)",
    infusion: "Chemo / therapeutic infusion (964xx)",
    dme: "DME / supply HCPCS (E/K/L…)",
    sleep_study: "Sleep diagnostics / titration",
    therapy_units_threshold: "Therapy visits — cumulative unit threshold",
  };

  useEffect(() => {
    if (state && "ok" in state && state.ok && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [state]);

  if (!canEdit) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Read-only: ask a tenant admin or platform super admin to update onboarding
        checklists.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p
          ref={bannerRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none"
        >
          Progress saved. This data stays in tenant settings (not PHI).
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Milestones & EHR context
        </h2>
        <div>
          <label
            htmlFor="milestoneNotes"
            className="block text-xs font-medium text-slate-700"
          >
            Contract milestones / week notes
          </label>
          <textarea
            id="milestoneNotes"
            name="milestoneNotes"
            rows={3}
            defaultValue={implementation?.milestoneNotes ?? ""}
            placeholder="e.g. Week 2: IT VPN draft complete; Week 3: test cohort agreed"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="ehrVendor"
              className="block text-xs font-medium text-slate-700"
            >
              Practice system / EHR (vendor)
            </label>
            <input
              id="ehrVendor"
              name="ehrVendor"
              defaultValue={implementation?.ehrVendor ?? ""}
              placeholder="e.g. Dentrix Enterprise, Epic, Open Dental"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label
              htmlFor="integrationPattern"
              className="block text-xs font-medium text-slate-700"
            >
              Integration pattern (expected)
            </label>
            <input
              id="integrationPattern"
              name="integrationPattern"
              defaultValue={implementation?.integrationPattern ?? ""}
              placeholder="e.g. FHIR R4, HL7 ADT/DFT, vendor API, nightly SFTP"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Connect — trading partner / EDI enrollment
        </h2>
        <p className="text-xs text-slate-600">
          Operational metadata for your clearinghouse (not PHI). Used for
          cutover planning; does not submit claims.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Clearinghouse
            </label>
            <select
              name="tp_clearinghouseKey"
              defaultValue={tpClearinghouseSelect}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="">— Select —</option>
              <option value="availity">Availity</option>
              <option value="change_healthcare">Change Healthcare</option>
              <option value="office_ally">Office Ally</option>
              <option value="optum">Optum (EDI)</option>
              <option value="navicure">Navicure / RelayHealth</option>
              <option value="emdeon">Emdeon / legacy</option>
              <option value="other">Other…</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Other (label)
            </label>
            <input
              name="tp_clearinghouseOther"
              defaultValue={tpClearinghouseOtherDefault}
              placeholder="If Other, type partner name"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Display label (optional)
            </label>
            <input
              name="tp_displayLabel"
              defaultValue={tp?.displayLabel ?? ""}
              placeholder="e.g. Pacific region production CH"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <span className="block text-xs font-medium text-slate-700">
              Environment
            </span>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-800">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="tp_environment"
                  value="test"
                  defaultChecked={(tp?.environment ?? "test") === "test"}
                  className="border-slate-300"
                />
                Test / cert
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  name="tp_environment"
                  value="production"
                  defaultChecked={tp?.environment === "production"}
                  className="border-slate-300"
                />
                Production
              </label>
            </div>
          </div>
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                name="tp_interchangeEnrollmentComplete"
                value="on"
                defaultChecked={tp?.interchangeEnrollmentComplete === true}
                className="mt-0.5 rounded border-slate-300"
              />
              ISA/GS production enrollment complete
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              ISA sender ID (I15 / ISA06 context)
            </label>
            <input
              name="tp_isaSenderId"
              defaultValue={tp?.isaSenderId ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              ISA receiver ID (ISA08 context)
            </label>
            <input
              name="tp_isaReceiverId"
              defaultValue={tp?.isaReceiverId ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              GS application sender code (GS02)
            </label>
            <input
              name="tp_gsSenderCode"
              defaultValue={tp?.gsSenderCode ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              GS application receiver code (GS03)
            </label>
            <input
              name="tp_gsReceiverCode"
              defaultValue={tp?.gsReceiverCode ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Enrollment notes (ticket #, cert window, …)
            </label>
            <textarea
              name="tp_notes"
              rows={2}
              defaultValue={tp?.notes ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Connect — prior authorization (medical benefit)
        </h2>
        <p className="text-xs text-slate-600">
          Staff queue defaults for deterministic Build warnings and Connect
          Authorizations. Does not submit to payers or enable pharmacy ePA.
        </p>
        <input type="hidden" name="pa_categories_submitted" value="on" />
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              name="pa_enabled"
              value="on"
              defaultChecked={pa.enabled !== false}
              className="mt-0.5 rounded border-slate-300"
            />
            Enable prior auth workspace and Build screening
          </label>
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-700">
            Unknown plan / missing benefit labels
          </span>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-800">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pa_unknown_plan"
                value="review_required"
                defaultChecked={pa.unknownPlanBehavior !== "proceed_low_risk"}
                className="border-slate-300"
              />
              Require staff review (default)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="pa_unknown_plan"
                value="proceed_low_risk"
                defaultChecked={pa.unknownPlanBehavior === "proceed_low_risk"}
                className="border-slate-300"
              />
              Proceed on low-risk lines only (still manual PA)
            </label>
          </div>
        </div>
        <div>
          <span className="block text-xs font-medium text-slate-700">
            High-risk categories (Build deterministic warnings)
          </span>
          <ul className="mt-2 space-y-2">
            {DEFAULT_PRIOR_AUTH_HIGH_RISK.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    name={`pa_cat_${id}`}
                    value="on"
                    defaultChecked={paCats.has(id)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>{paCatLabels[id]}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Intake start (hours)
            </label>
            <input
              name="pa_intake_hours"
              type="number"
              min={0}
              defaultValue={pa.intakeStartHours}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Standard decision SLA (days)
            </label>
            <input
              name="pa_std_sla_days"
              type="number"
              min={0}
              defaultValue={pa.standardDecisionSlaDays}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Expedited decision SLA (hours)
            </label>
            <input
              name="pa_exp_sla_hours"
              type="number"
              min={0}
              defaultValue={pa.expeditedDecisionSlaHours}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Follow-up interval (hours)
            </label>
            <input
              name="pa_followup_hours"
              type="number"
              min={0}
              defaultValue={pa.followUpIntervalHours}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Expiring soon window (days)
            </label>
            <input
              name="pa_expiring_days"
              type="number"
              min={0}
              defaultValue={pa.expiringSoonDays}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Labor rate (cents / hour, optional)
            </label>
            <input
              name="pa_labor_rate_cents"
              type="number"
              min={0}
              defaultValue={pa.laborRateCentsPerHour ?? ""}
              placeholder="e.g. 8500"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Rework tracking fields (comma-separated keys)
            </label>
            <input
              name="pa_rework_fields"
              defaultValue={pa.reworkTrackingFields.join(", ")}
              placeholder="denialReason, resubmissionCount"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Key contacts</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              IT primary — name
            </label>
            <input
              name="contact_it_name"
              defaultValue={c?.itName ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              IT primary — email
            </label>
            <input
              name="contact_it_email"
              type="email"
              defaultValue={c?.itEmail ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Billing / RCM lead — name
            </label>
            <input
              name="contact_billing_name"
              defaultValue={c?.billingLeadName ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Billing / RCM lead — email
            </label>
            <input
              name="contact_billing_email"
              type="email"
              defaultValue={c?.billingLeadEmail ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Weeks 1–3 — billing discovery
        </h2>
        <ul className="space-y-2">
          {BILLING_DISCOVERY_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <label className="flex cursor-pointer gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  name={`b:${id}`}
                  value="on"
                  defaultChecked={bill[id] === true}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Weeks 1–3 — IT / EHR workstream
        </h2>
        <ul className="space-y-2">
          {IT_EHR_WORKSTREAM_ITEMS.map(({ id, label }) => (
            <li key={id}>
              <label className="flex cursor-pointer gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  name={`i:${id}`}
                  value="on"
                  defaultChecked={it[id] === true}
                  className="mt-0.5 rounded border-slate-300"
                />
                <span>{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save implementation progress"}
      </Button>
    </form>
  );
}

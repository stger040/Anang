"use client";

import { Button } from "@anang/ui";
import { useFormStatus } from "react-dom";
import {
  createCoverAssistanceCase,
  updateCoverCaseStatus,
} from "./actions";

type PatientOption = { id: string; label: string };
type CaseRow = {
  id: string;
  track: string;
  status: string;
  householdSize: number | null;
  annualIncomeCents: number | null;
  notes: string | null;
  updatedAt: Date;
  patient: { firstName: string; lastName: string; mrn: string | null };
};

const TRACK_LABEL: Record<string, string> = {
  financial_assistance: "Financial assistance",
  coverage_marketplace: "Coverage / marketplace",
  medicaid_info: "Medicaid info / screening",
  charity_care: "Charity care",
  other: "Other",
};

const STATUS_OPTIONS = [
  "submitted",
  "in_review",
  "approved",
  "denied",
  "needs_info",
  "closed",
] as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function CoverWorkspace({
  orgSlug,
  patients,
  cases,
  defaultPatientId,
}: {
  orgSlug: string;
  patients: PatientOption[];
  cases: CaseRow[];
  defaultPatientId?: string;
}) {
  const canCreate = patients.length > 0;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            New assistance case
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Staff intake — maps to Cover workflow (FAP, marketplace, Medicaid
            routing). Staging intake — wire eligibility vendors for production.
          </p>
          {!canCreate ? (
            <p className="mt-4 text-sm text-amber-800">
              Add patients (EHR feed or seed) before creating Cover cases.
            </p>
          ) : (
          <form action={createCoverAssistanceCase} className="mt-4 space-y-3">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Patient
              </label>
              <select
                name="patientId"
                required
                defaultValue={
                  defaultPatientId &&
                  patients.some((x) => x.id === defaultPatientId)
                    ? defaultPatientId
                    : patients[0]!.id
                }
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-sky focus:ring-2"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Track
              </label>
              <select
                name="track"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-sky focus:ring-2"
              >
                {Object.entries(TRACK_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Household size (optional)
                </label>
                <input
                  name="householdSize"
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Annual income USD (optional)
                </label>
                <input
                  name="annualIncomeDollars"
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-sky"
              />
            </div>
            <SubmitButton label="Create case" />
          </form>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-gradient-to-br from-orange-50/80 to-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Cover operations
          </h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>270/271 eligibility — connect vendor when pilot is ready.</li>
            <li>
              Policy playbooks & FAP text — per-tenant config in{" "}
              <code className="rounded bg-slate-100 px-1 text-xs">settings</code>{" "}
              (roadmap).
            </li>
            <li>Patient SMS / magic-link journeys — see product docs.</li>
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Open cases</h2>
          <p className="text-xs text-slate-500">
            Newest updates first — change status as counselors progress.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Patient</th>
                <th className="px-4 py-2">Track</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">HH / Income</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    No cases yet — create one with the form above.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.patient.lastName}, {c.patient.firstName}
                      <div className="font-mono text-xs font-normal text-slate-500">
                        {c.patient.mrn ?? c.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {TRACK_LABEL[c.track] ?? c.track}
                    </td>
                    <td className="px-4 py-3">
                      <form action={updateCoverCaseStatus} className="flex flex-col gap-1">
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="caseId" value={c.id} />
                        <select
                          name="status"
                          defaultValue={c.status}
                          className="max-w-[10rem] rounded border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-sky"
                          onChange={(e) => {
                            e.currentTarget.form?.requestSubmit();
                          }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </form>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-slate-600">
                      {c.householdSize != null ? `${c.householdSize} ppl` : "—"}
                      <br />
                      {c.annualIncomeCents != null
                        ? usd(c.annualIncomeCents)
                        : "—"}
                    </td>
                    <td className="max-w-[14rem] px-4 py-3 text-xs text-slate-600">
                      {c.notes ? (
                        <span className="line-clamp-3">{c.notes}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {c.updatedAt.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

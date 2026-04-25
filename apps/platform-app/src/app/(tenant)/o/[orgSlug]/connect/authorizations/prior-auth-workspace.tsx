"use client";

import { Badge, Button, Card } from "@anang/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { PriorAuthStatus } from "@prisma/client";

import { createPriorAuthCase } from "./actions";

type PatientOpt = { id: string; firstName: string; lastName: string; mrn: string | null };

type CaseRow = {
  id: string;
  caseNumber: string;
  status: PriorAuthStatus;
  payerName: string;
  scheduledAt: Date | null;
  dueAt: Date | null;
  expiresAt: Date | null;
  updatedAt: Date;
  patient: PatientOpt;
  sla: { overdue: boolean; expiringSoon: boolean; followUpNeeded: boolean };
};

const STATUS_LABEL: Partial<Record<PriorAuthStatus, string>> = {
  DRAFT: "draft",
  INTAKE: "intake",
  REVIEW_REQUIRED: "review required",
  SUBMITTED: "submitted",
  IN_REVIEW: "in review",
  PENDING_INFO: "pending info",
  APPROVED: "approved",
  DENIED: "denied",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  REWORK: "rework",
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" size="sm" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export function PriorAuthWorkspace({
  orgSlug,
  cases,
  patients,
}: {
  orgSlug: string;
  cases: CaseRow[];
  patients: PatientOpt[];
}) {
  const [status, setStatus] = useState<string>("");
  const [payerQ, setPayerQ] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [schedFrom, setSchedFrom] = useState("");

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (status && c.status !== status) return false;
      if (payerQ && !c.payerName.toLowerCase().includes(payerQ.toLowerCase())) return false;
      if (overdueOnly && !c.sla.overdue) return false;
      if (expiringOnly && !c.sla.expiringSoon) return false;
      if (schedFrom && c.scheduledAt) {
        const t = new Date(schedFrom).getTime();
        if (c.scheduledAt.getTime() < t) return false;
      }
      return true;
    });
  }, [cases, status, payerQ, overdueOnly, expiringOnly, schedFrom]);

  return (
    <div className="space-y-8">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Status</span>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              {Object.keys(STATUS_LABEL).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Payer contains</span>
            <input
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={payerQ}
              onChange={(e) => setPayerQ(e.target.value)}
              placeholder="e.g. Demo"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">Scheduled on/after</span>
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              value={schedFrom}
              onChange={(e) => setSchedFrom(e.target.value)}
            />
          </label>
          <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
            />
            Overdue (past internal due)
          </label>
          <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={expiringOnly}
              onChange={(e) => setExpiringOnly(e.target.checked)}
            />
            Expiring soon
          </label>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Queue</h2>
          <p className="mt-1 text-xs text-slate-500">
            {filtered.length} case{filtered.length === 1 ? "" : "s"} match filters.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Case</th>
                  <th className="py-2 pr-3">Patient</th>
                  <th className="py-2 pr-3">Payer</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">SLA</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="py-2 pr-3 font-mono text-xs">{c.caseNumber}</td>
                    <td className="py-2 pr-3 text-slate-800">
                      {c.patient.lastName}, {c.patient.firstName}
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{c.payerName}</td>
                    <td className="py-2 pr-3">
                      <Badge tone="teal">{STATUS_LABEL[c.status] ?? c.status}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {c.sla.overdue ? <span className="font-medium text-red-700">Overdue</span> : null}
                      {c.sla.expiringSoon ? (
                        <span className="ml-1 font-medium text-amber-800">Expiring</span>
                      ) : null}
                      {c.sla.followUpNeeded ? (
                        <span className="ml-1 font-medium text-slate-800">Follow up</span>
                      ) : null}
                      {!c.sla.overdue && !c.sla.expiringSoon && !c.sla.followUpNeeded ? "—" : null}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Link href={`/o/${orgSlug}/connect/authorizations/${c.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">New case</h2>
          <p className="mt-1 text-xs text-slate-500">
            Creates a tracked PA row only — nothing is sent to a payer from this form.
          </p>
          <form action={createPriorAuthCase} className="mt-4 space-y-3">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <div>
              <label className="block text-xs font-medium text-slate-700">Patient</label>
              <select
                name="patientId"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                defaultValue=""
              >
                <option value="" disabled>
                  Select…
                </option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName}, {p.firstName}
                    {p.mrn ? ` · ${p.mrn}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Payer name</label>
              <input
                name="payerName"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="As shown on card / portal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Plan name (optional)</label>
              <input
                name="payerPlanName"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Urgency</label>
              <select
                name="urgency"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                defaultValue="ROUTINE"
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="EXPEDITED">Expedited</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Priority</label>
              <select
                name="priority"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                defaultValue="normal"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <SubmitButton label="Create case" />
          </form>
        </Card>
      </div>
    </div>
  );
}

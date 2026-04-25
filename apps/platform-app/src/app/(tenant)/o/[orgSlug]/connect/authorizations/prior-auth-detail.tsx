"use client";

import { Badge, Button, Card } from "@anang/ui";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import type {
  PriorAuthCase,
  PriorAuthChecklistItem,
  PriorAuthEvent,
  PriorAuthService,
  Claim,
  Encounter,
  Coverage,
  Patient,
} from "@prisma/client";

import {
  appendPriorAuthEvent,
  linkPriorAuthToClaim,
  linkPriorAuthToEncounter,
  updatePriorAuthCaseStatus,
  updatePriorAuthChecklistItem,
} from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

type CaseFull = PriorAuthCase & {
  patient: Patient;
  encounter: Pick<Encounter, "id" | "dateOfService"> | null;
  claim: Pick<Claim, "id" | "claimNumber"> | null;
  coverage: Pick<Coverage, "id" | "payerName" | "planName"> | null;
  checklistItems: PriorAuthChecklistItem[];
  services: PriorAuthService[];
  events: PriorAuthEvent[];
};

export function PriorAuthDetail({
  orgSlug,
  caseRow,
  claims,
  encounters,
}: {
  orgSlug: string;
  caseRow: CaseFull;
  claims: Pick<Claim, "id" | "claimNumber" | "status">[];
  encounters: Pick<Encounter, "id" | "dateOfService">[];
}) {
  const c = caseRow;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-slate-500">Prior authorization</p>
          <h1 className="text-xl font-semibold text-slate-900">{c.caseNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {c.patient.lastName}, {c.patient.firstName}
            {c.patient.mrn ? ` · MRN ${c.patient.mrn}` : ""}
          </p>
        </div>
        <Link href={`/o/${orgSlug}/connect/authorizations`}>
          <Button type="button" variant="secondary" size="sm">
            Back to queue
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Payer & decision</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Payer</dt>
              <dd className="font-medium text-slate-900">{c.payerName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Plan</dt>
              <dd>{c.payerPlanName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Auth number</dt>
              <dd className="font-mono text-xs">{c.authorizationNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd>
                <Badge tone="teal">{c.status.replaceAll("_", " ")}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Expires</dt>
              <dd>{c.expiresAt ? c.expiresAt.toLocaleDateString() : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Internal due</dt>
              <dd>{c.dueAt ? c.dueAt.toLocaleString() : "—"}</dd>
            </div>
          </dl>

          <form action={updatePriorAuthCaseStatus} className="mt-6 space-y-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="caseId" value={c.id} />
            <label className="block text-xs font-medium text-slate-700">Update status</label>
            <div className="flex flex-wrap gap-2">
              <select
                name="status"
                defaultValue={c.status}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                required
              >
                {[
                  "DRAFT",
                  "INTAKE",
                  "REVIEW_REQUIRED",
                  "SUBMITTED",
                  "IN_REVIEW",
                  "PENDING_INFO",
                  "APPROVED",
                  "DENIED",
                  "REWORK",
                  "EXPIRED",
                  "CANCELLED",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <Submit label="Save status" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-600">Authorization # (when approved)</label>
                <input
                  name="authorizationNumber"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                  placeholder="Payer reference"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600">Expires at</label>
                <input
                  type="datetime-local"
                  name="expiresAt"
                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-sm"
                />
              </div>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Links</h2>
          <ul className="mt-2 space-y-2 text-sm">
            <li>
              Patient:{" "}
              <span className="font-medium">
                {c.patient.lastName}, {c.patient.firstName}
              </span>
            </li>
            <li>
              Encounter:{" "}
              {c.encounter ? (
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/build/encounters/${c.encounter.id}`}
                >
                  DOS {c.encounter.dateOfService.toLocaleDateString()}
                </Link>
              ) : (
                "—"
              )}
            </li>
            <li>
              Claim:{" "}
              {c.claim ? (
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/connect/claims/${c.claim.id}`}
                >
                  {c.claim.claimNumber}
                </Link>
              ) : (
                "—"
              )}
            </li>
            <li>Coverage: {c.coverage ? `${c.coverage.payerName} · ${c.coverage.planName ?? ""}` : "—"}</li>
          </ul>

          <form action={linkPriorAuthToEncounter} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="caseId" value={c.id} />
            <label className="text-xs font-medium text-slate-700">Link encounter</label>
            <select name="encounterId" className="w-full rounded border border-slate-200 px-2 py-1 text-sm">
              <option value="">Select…</option>
              {encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.dateOfService.toLocaleDateString()}
                </option>
              ))}
            </select>
            <Submit label="Link" />
          </form>

          <form action={linkPriorAuthToClaim} className="mt-4 space-y-2">
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="caseId" value={c.id} />
            <label className="text-xs font-medium text-slate-700">Link claim</label>
            <select name="claimId" className="w-full rounded border border-slate-200 px-2 py-1 text-sm">
              <option value="">Select…</option>
              {claims.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.claimNumber} ({String(cl.status).toLowerCase()})
                </option>
              ))}
            </select>
            <Submit label="Link claim" />
          </form>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Services on case</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Type</th>
                <th className="py-2">Code</th>
                <th className="py-2">Units</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {c.services.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-slate-500">
                    No service rows yet.
                  </td>
                </tr>
              ) : (
                c.services.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2">{s.codeType}</td>
                    <td className="py-2 font-mono text-xs">{s.code}</td>
                    <td className="py-2">{s.units}</td>
                    <td className="py-2 text-slate-700">{s.description ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Checklist</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {c.checklistItems.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-slate-900">{item.label}</p>
                <Badge tone="default">{item.status.replaceAll("_", " ")}</Badge>
              </div>
              <form action={updatePriorAuthChecklistItem} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="itemId" value={item.id} />
                <select name="status" className="rounded border border-slate-200 px-2 py-1 text-xs">
                  <option value="PENDING">Pending</option>
                  <option value="DONE">Done</option>
                  <option value="NA">N/A</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
                <input
                  name="notes"
                  placeholder="Notes"
                  className="min-w-[8rem] flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <Submit label="Update" />
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Status history</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {c.events.map((ev) => (
            <li key={ev.id} className="border-b border-slate-50 pb-2">
              <span className="text-xs text-slate-500">{ev.createdAt.toLocaleString()}</span>
              <span className="ml-2 font-mono text-xs">{ev.eventType}</span>
            </li>
          ))}
        </ul>
        <form action={appendPriorAuthEvent} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="caseId" value={c.id} />
          <input type="hidden" name="eventType" value="prior_auth.staff.note" />
          <label className="text-xs font-medium text-slate-700">Add staff note (audit event)</label>
          <textarea name="note" rows={2} className="w-full rounded border border-slate-200 px-2 py-1 text-sm" />
          <Submit label="Append note" />
        </form>
      </Card>
    </div>
  );
}

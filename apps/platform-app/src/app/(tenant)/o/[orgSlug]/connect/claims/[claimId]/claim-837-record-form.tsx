"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  recordClaim837EdiSubmission,
  type Record837SubmissionState,
} from "../../actions";

export function Claim837RecordForm({
  orgSlug,
  claimId,
}: {
  orgSlug: string;
  claimId: string;
}) {
  const [state, formAction, pending] = useActionState<
    Record837SubmissionState,
    FormData
  >(recordClaim837EdiSubmission, null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="claimId" value={claimId} />
      <p className="text-xs font-medium text-slate-700">
        Record outbound 837 controls (manual)
      </p>
      <p className="text-xs text-slate-500">
        After your clearinghouse or PM system generates the 837, paste ISA / GS /
        ST (or trace / payer ref) so 277/835 can be correlated operationally. This
        does not submit a claim.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">
            Clearinghouse / partner
          </label>
          <input
            name="clearinghouseLabel"
            required
            placeholder="e.g. Availity, Change Healthcare"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            ISA control #
          </label>
          <input
            name="interchangeControlNumber"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            GS control #
          </label>
          <input
            name="groupControlNumber"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            ST control #
          </label>
          <input
            name="transactionSetControlNumber"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Submitter trace
          </label>
          <input
            name="submitterTraceNumber"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600">
            Payer claim control ref
          </label>
          <input
            name="payerClaimControlRef"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-xs shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-600">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
        </div>
      </div>
      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 outline-none"
        >
          Saved. Timeline and EDI references updated.
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save 837 trace"}
      </Button>
    </form>
  );
}

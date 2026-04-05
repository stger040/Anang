"use client";

import { createStatementPaymentPlanAction } from "@/app/(tenant)/o/[orgSlug]/pay/payment-plan-actions";
import { Button, Card } from "@anang/ui";
import { useActionState } from "react";

export function StatementPaymentPlanStaffForm({
  orgSlug,
  statementId,
  balanceCents,
}: {
  orgSlug: string;
  statementId: string;
  balanceCents: number;
}) {
  const [state, action, pending] = useActionState(
    createStatementPaymentPlanAction,
    null as { ok: boolean; error?: string } | null,
  );

  if (balanceCents <= 0) {
    return null;
  }

  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 14);
  const defaultDue = defaultDate.toISOString().slice(0, 10);

  return (
    <Card className="mt-6 border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900">
        Payment plan (patient)
      </h3>
      <p className="mt-2 text-xs text-slate-600">
        Offer equal installments against the current balance. Patients see the
        schedule on their magic-link page and can acknowledge it (installment
        autopay is future work).
      </p>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="statementId" value={statementId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[11px] font-medium text-slate-600">
            Installments
            <input
              name="installmentCount"
              type="number"
              min={2}
              max={12}
              defaultValue={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-[11px] font-medium text-slate-600">
            Weeks between dues
            <input
              name="intervalWeeks"
              type="number"
              min={1}
              max={52}
              defaultValue={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-[11px] font-medium text-slate-600">
          First due date
          <input
            name="firstDueDate"
            type="date"
            required
            defaultValue={defaultDue}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] font-medium text-slate-600">
          Label (optional)
          <input
            name="label"
            type="text"
            placeholder="Payment plan"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save / replace plan offer"}
        </Button>
      </form>
      {state?.ok ? (
        <p className="mt-3 text-xs font-medium text-emerald-800">
          Plan saved. Share a patient link so they can review and acknowledge.
        </p>
      ) : null}
      {state && !state.ok && state.error ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
    </Card>
  );
}

"use client";

import { acknowledgeStatementPaymentPlanAction } from "@/app/p/[orgSlug]/pay/[token]/acknowledge-plan-action";
import { Button, Card } from "@anang/ui";
import { useActionState } from "react";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PatientPaymentPlanAckPanel({
  orgSlug,
  token,
  plan,
}: {
  orgSlug: string;
  token: string;
  plan: {
    id: string;
    label: string;
    status: string;
    installmentCount: number;
    intervalWeeks: number;
    patientAcknowledgedAt: Date | null;
    installments: {
      sequence: number;
      dueDate: Date;
      amountCents: number;
      satisfiedCents: number;
      status: string;
    }[];
  };
}) {
  const [state, action, pending] = useActionState(
    acknowledgeStatementPaymentPlanAction,
    null as { ok: boolean; error?: string } | null,
  );

  const acknowledged =
    plan.status === "acknowledged" || plan.patientAcknowledgedAt != null;

  return (
    <Card className="mt-6 border-teal-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{plan.label}</h2>
      <p className="mt-1 text-xs text-slate-600">
        {plan.installmentCount} payments · every {plan.intervalWeeks} week
        {plan.intervalWeeks === 1 ? "" : "s"}
      </p>
      <ul className="mt-4 space-y-2 text-sm">
        {plan.installments.map((i) => (
          <li
            key={i.sequence}
            className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
          >
            <span className="text-slate-700">
              #{i.sequence} · due{" "}
              {i.dueDate.toLocaleDateString(undefined, { dateStyle: "medium" })}{" "}
              · <span className="font-medium">{i.status}</span>
              {i.satisfiedCents > 0 && i.satisfiedCents < i.amountCents ? (
                <span className="text-slate-500">
                  {" "}
                  · paid {usd(i.satisfiedCents)} / {usd(i.amountCents)}
                </span>
              ) : null}
            </span>
            <span className="tabular-nums font-medium text-slate-900">
              {usd(i.amountCents)}
            </span>
          </li>
        ))}
      </ul>
      {acknowledged ? (
        <p className="mt-4 text-sm font-medium text-emerald-800">
          You acknowledged this schedule on{" "}
          {plan.patientAcknowledgedAt
            ? plan.patientAcknowledgedAt.toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "a prior visit"}
          .
        </p>
      ) : (
        <form action={action} className="mt-5 space-y-3">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="planId" value={plan.id} />
          <p className="text-xs text-slate-600">
            Acknowledging records that you have reviewed this installment
            schedule. It is not a new promise to pay and does not replace your
            agreement with the provider.
          </p>
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? "Saving…" : "I have reviewed this schedule"}
          </Button>
        </form>
      )}
      {state?.ok ? (
        <p className="mt-3 text-xs font-medium text-emerald-800">
          Thanks — your acknowledgement was recorded.
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

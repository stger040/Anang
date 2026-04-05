"use client";

import { markPaymentPlanInstallmentPaidAction } from "@/app/(tenant)/o/[orgSlug]/pay/payment-plan-actions";
import { setPatientBillingSmsConsentAction } from "@/app/(tenant)/o/[orgSlug]/pay/billing-sms-consent-actions";
import { Button } from "@anang/ui";
import { useActionState } from "react";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function BillingSmsConsentForms({
  orgSlug,
  statementId,
  patientId,
  optInAt,
  optOutAt,
}: {
  orgSlug: string;
  statementId: string;
  patientId: string;
  optInAt: Date | null;
  optOutAt: Date | null;
}) {
  const [stateIn, actionIn, pendingIn] = useActionState(
    setPatientBillingSmsConsentAction,
    null as { ok: boolean; error?: string } | null,
  );
  const [stateOut, actionOut, pendingOut] = useActionState(
    setPatientBillingSmsConsentAction,
    null as { ok: boolean; error?: string } | null,
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-600">
        Billing SMS consent (TCPA-style tracking)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Text-to-pay requires recorded opt-in; opt-out is honored. Quiet hours
        and per-tenant Twilio live in{" "}
        <span className="font-mono">Tenant.settings.messaging</span>.
      </p>
      <dl className="mt-2 space-y-1 text-xs text-slate-700">
        <div>
          <dt className="inline text-slate-500">Opt-in: </dt>
          <dd className="inline font-medium">
            {optInAt ? optInAt.toLocaleString() : "—"}
          </dd>
        </div>
        <div>
          <dt className="inline text-slate-500">Opt-out: </dt>
          <dd className="inline font-medium">
            {optOutAt ? optOutAt.toLocaleString() : "—"}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={actionIn}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="statementId" value={statementId} />
          <input type="hidden" name="consent" value="in" />
          <Button type="submit" size="sm" variant="secondary" disabled={pendingIn}>
            {pendingIn ? "Saving…" : "Record opt-in (now)"}
          </Button>
        </form>
        <form action={actionOut}>
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="patientId" value={patientId} />
          <input type="hidden" name="statementId" value={statementId} />
          <input type="hidden" name="consent" value="out" />
          <Button type="submit" size="sm" variant="secondary" disabled={pendingOut}>
            {pendingOut ? "Saving…" : "Record opt-out (now)"}
          </Button>
        </form>
      </div>
      {stateIn && !stateIn.ok && stateIn.error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {stateIn.error}
        </p>
      ) : null}
      {stateOut && !stateOut.ok && stateOut.error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {stateOut.error}
        </p>
      ) : null}
    </div>
  );
}

export function InstallmentMarkPaidRow({
  orgSlug,
  installmentId,
  balanceCents,
  amountCents,
  satisfiedCents,
  status,
  dueDateLabel,
  sequence,
}: {
  orgSlug: string;
  installmentId: string;
  balanceCents: number;
  amountCents: number;
  satisfiedCents: number;
  status: string;
  dueDateLabel: string;
  sequence: number;
}) {
  const [state, action, pending] = useActionState(
    markPaymentPlanInstallmentPaidAction,
    null as { ok: boolean; error?: string } | null,
  );
  const rem = Math.max(0, amountCents - satisfiedCents);
  const showMark =
    balanceCents > 0 && rem > 0 && status !== "paid" && status !== "skipped";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100/80 pb-2 last:border-0">
      <span>
        #{sequence} {dueDateLabel} · scheduled {usd(amountCents)}
        {satisfiedCents > 0 ? <> · satisfied {usd(satisfiedCents)}</> : null} ·{" "}
        <span className="font-medium text-slate-800">{status}</span>
      </span>
      {showMark ? (
        <form action={action} className="flex flex-col items-end gap-1">
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="installmentId" value={installmentId} />
          <Button type="submit" size="sm" variant="primary" disabled={pending}>
            {pending ? "Posting…" : `Mark paid (${usd(rem)})`}
          </Button>
          {state && !state.ok && state.error ? (
            <span className="text-xs text-red-700">{state.error}</span>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

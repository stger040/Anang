import { PatientPayLinkErrorPanel } from "@/components/patient-pay-link-error";
import { verifyPatientPayTokenDetailed } from "@/lib/patient-pay-token";
import { tenantPrisma } from "@/lib/prisma";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { formatSupportRef } from "@/lib/support-ref";
import { getStripe } from "@/lib/stripe-server";
import { Badge, Card } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientPayPaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; token: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { orgSlug, token: rawToken } = await params;
  const { session_id: sessionId } = await searchParams;
  const token = decodeURIComponent(rawToken);

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true, displayName: true },
  });
  if (!tenant) notFound();

  const reqId = await readRequestIdFromHeaders();
  const supportRef = formatSupportRef(reqId);

  let statementId: string | null = null;

  const tokenMatch = verifyPatientPayTokenDetailed(token, orgSlug);
  if (tokenMatch.ok) {
    statementId = tokenMatch.payload.statementId;
  }

  const stripe = getStripe();
  let stripeSession:
    | Awaited<ReturnType<NonNullable<typeof stripe>["checkout"]["sessions"]["retrieve"]>>
    | null = null;

  if (sessionId && stripe) {
    try {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      stripeSession = s;
      if (
        s.payment_status === "paid" &&
        s.metadata?.tenantId === tenant.id &&
        s.metadata?.statementId
      ) {
        statementId = s.metadata.statementId;
      }
    } catch {
      /* ignore */
    }
  }

  if (!statementId) {
    if (sessionId) {
      return (
        <PatientPayLinkErrorPanel
          variant="receipt"
          orgSlug={orgSlug}
          orgDisplayName={tenant.displayName}
          supportRef={supportRef}
        />
      );
    }
    return (
      <PatientPayLinkErrorPanel
        reason={tokenMatch.ok ? "invalid" : tokenMatch.reason}
        orgSlug={orgSlug}
        orgDisplayName={tenant.displayName}
        supportRef={supportRef}
      />
    );
  }

  const stmt = await tenantPrisma(orgSlug).statement.findFirst({
    where: { id: statementId, tenantId: tenant.id },
    select: {
      number: true,
      balanceCents: true,
      payments: {
        where: { status: "posted" },
        orderBy: { paidAt: "desc" },
        take: 8,
        select: {
          id: true,
          amountCents: true,
          paidAt: true,
          method: true,
          stripeCheckoutSessionId: true,
        },
      },
    },
  });
  if (!stmt) {
    return (
      <PatientPayLinkErrorPanel
        variant="statement"
        orgSlug={orgSlug}
        orgDisplayName={tenant.displayName}
        supportRef={supportRef}
      />
    );
  }

  let sessionOk = false;
  if (sessionId && stripeSession) {
    sessionOk =
      stripeSession.payment_status === "paid" &&
      stripeSession.metadata?.statementId === statementId &&
      stripeSession.metadata?.tenantId === tenant.id;
  }

  const receiptAmountCents =
    sessionOk && stripeSession?.amount_total != null
      ? stripeSession.amount_total
      : stmt.payments.find((p) => p.stripeCheckoutSessionId === sessionId)
          ?.amountCents ??
        stmt.payments[0]?.amountCents ??
        null;

  const receiptPaidAt =
    sessionOk && stripeSession?.created
      ? new Date(stripeSession.created * 1000)
      : stmt.payments.find((p) => p.stripeCheckoutSessionId === sessionId)
          ?.paidAt ?? stmt.payments[0]?.paidAt ?? null;

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">
        {tenant.displayName}
      </p>
      <h1 className="mt-4 text-center text-2xl font-semibold text-slate-900">
        Thank you
      </h1>
      <Card className="mt-8 p-6 shadow-sm">
        <div className="flex flex-wrap justify-center gap-2">
          <Badge tone="success">Payment</Badge>
          <span className="font-mono text-xs text-slate-600">{stmt.number}</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-700">
          {sessionOk
            ? "Your payment was accepted. Your balance usually updates within a few moments."
            : sessionId
              ? "We are reviewing your payment. If the amount due still looks wrong, wait a moment and open your link again."
              : "If you completed payment, your balance will refresh shortly."}
        </p>
        {stmt.balanceCents === 0 ? (
          <p className="mt-4 text-sm font-medium text-emerald-800">
            This statement shows no remaining balance.
          </p>
        ) : null}

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/90 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Receipt summary
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Amount</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {receiptAmountCents != null
                  ? usd(receiptAmountCents)
                  : sessionOk
                    ? "—"
                    : "See your card or bank statement"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600">Date</dt>
              <dd className="tabular-nums text-slate-800">
                {receiptPaidAt
                  ? receiptPaidAt.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "—"}
              </dd>
            </div>
            {sessionId ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Reference</dt>
                <dd className="break-all font-mono text-[11px] text-slate-700">
                  {sessionId.length > 12
                    ? `…${sessionId.slice(-12)}`
                    : sessionId}
                </dd>
              </div>
            ) : null}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Save or screenshot this page for your records. Official tax or HSA
            documentation may arrive separately from your provider.
          </p>
        </div>

        {stmt.payments.length > 0 ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Posted payments on file
            </h2>
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs text-slate-700">
              {stmt.payments.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between gap-2 border-b border-slate-50 pb-2 last:border-0"
                >
                  <span>
                    {p.paidAt
                      ? p.paidAt.toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "Pending date"}
                    {p.method ? ` · ${p.method}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">
                    {usd(p.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-6 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center">
          {tokenMatch.ok ? (
            <Link
              href={`/p/${encodeURIComponent(orgSlug)}/pay/${encodeURIComponent(token)}`}
              className="text-sm font-medium text-teal-700 underline"
            >
              Back to your statement
            </Link>
          ) : null}
          <Link
            href={`/p/${encodeURIComponent(orgSlug)}`}
            className="text-sm text-slate-600 underline"
          >
            Billing home
          </Link>
        </p>
      </Card>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

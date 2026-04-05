import { PatientPayLinkErrorPanel } from "@/components/patient-pay-link-error";
import { PatientPaymentPlanAckPanel } from "@/components/patient-payment-plan-ack";
import { PatientPayVerifyPanel } from "@/components/patient-pay-verify-panel";
import { PatientPayWithStripeButton } from "@/components/patient-pay-with-stripe-button";
import { StatementLineExplain } from "@/components/statement-line-explain";
import {
  PATIENT_PAY_GATE_COOKIE,
  patientPayVerificationHint,
  verifyPatientPayGateCookie,
} from "@/lib/patient-pay-gate";
import { verifyPatientPayTokenDetailed } from "@/lib/patient-pay-token";
import { prisma } from "@/lib/prisma";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { formatSupportRef } from "@/lib/support-ref";
import { Badge, Card } from "@anang/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientPayStatementPage({
  params,
}: {
  params: Promise<{ orgSlug: string; token: string }>;
}) {
  const { orgSlug, token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const reqId = await readRequestIdFromHeaders();
  const supportRef = formatSupportRef(reqId);

  const tokenResult = verifyPatientPayTokenDetailed(token, orgSlug);
  if (!tokenResult.ok) {
    return (
      <PatientPayLinkErrorPanel
        reason={tokenResult.reason}
        orgSlug={orgSlug}
        orgDisplayName={tenant.displayName}
        supportRef={supportRef}
      />
    );
  }
  const claims = tokenResult.payload;

  const cookieStore = await cookies();
  const gateRaw = cookieStore.get(PATIENT_PAY_GATE_COOKIE)?.value;
  const stepUpOk = verifyPatientPayGateCookie(gateRaw, token);

  if (!stepUpOk) {
    const lite = await prisma.statement.findFirst({
      where: { id: claims.statementId, tenantId: tenant.id },
      select: {
        patient: {
          select: { firstName: true, dob: true, mrn: true },
        },
      },
    });
    if (!lite) {
      return (
        <PatientPayLinkErrorPanel
          variant="statement"
          orgSlug={orgSlug}
          orgDisplayName={tenant.displayName}
          supportRef={supportRef}
        />
      );
    }

    const hint = patientPayVerificationHint({
      dob: lite.patient.dob,
      mrn: lite.patient.mrn,
    });

    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {tenant.displayName}
          </p>
        </div>
        <PatientPayVerifyPanel
          accessToken={token}
          hint={hint}
          orgDisplayName={tenant.displayName}
          patientFirstName={lite.patient.firstName}
        />
        <p className="mt-10 text-center text-xs text-slate-500">
          <Link href={`/p/${encodeURIComponent(orgSlug)}`} className="underline">
            Billing home
          </Link>
        </p>
      </div>
    );
  }

  const stmt = await prisma.statement.findFirst({
    where: { id: claims.statementId, tenantId: tenant.id },
    include: {
      patient: {
        include: {
          coverages: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
        },
      },
      lines: true,
      payments: { orderBy: { paidAt: "desc" }, take: 5 },
      paymentPlan: {
        include: {
          installments: { orderBy: { sequence: "asc" } },
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

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const greeting = greetingFirstName(stmt.patient.firstName);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {tenant.displayName}
        </p>
        <p className="mt-4 text-sm text-slate-600">Hello, {greeting}</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          Your statement
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">{stmt.number}</p>
      </div>

      <Card className="mt-8 overflow-hidden p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              stmt.status === "open"
                ? "warning"
                : stmt.status === "paid"
                  ? "success"
                  : "default"
            }
          >
            {stmt.status.replace(/_/g, " ")}
          </Badge>
          <span className="text-sm text-slate-600">
            Due{" "}
            <time dateTime={stmt.dueDate.toISOString()}>
              {stmt.dueDate.toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </time>
          </span>
        </div>

        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-slate-500">Total</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {usd(stmt.totalCents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Amount due</dt>
            <dd
              className="mt-1 text-2xl font-semibold tabular-nums"
              style={{ color: tenant.primaryColor }}
            >
              {usd(stmt.balanceCents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Recent payments</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums text-slate-900">
              {stmt.payments.length === 0
                ? "None yet"
                : String(stmt.payments.length)}
            </dd>
          </div>
        </dl>

        {stmt.balanceCents > 0 ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <p className="text-sm font-medium text-slate-900">
              Pay online securely
            </p>
            <p className="mt-1 text-xs text-slate-600">
              You will be redirected to our payment partner to complete this
              transaction.
            </p>
            <div className="mt-4">
              {stripeConfigured ? (
                <PatientPayWithStripeButton accessToken={token} />
              ) : (
                <p className="text-sm text-amber-800">
                  Online pay is not configured for this site yet. Please contact
                  billing.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-8 text-sm font-medium text-emerald-800">
            No balance is due on this statement. Thank you.
          </p>
        )}

        {stmt.balanceCents > 0 && !stmt.paymentPlan ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Payment plans
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              No installment schedule is on file for this statement yet. If you
              need to spread payments over time, contact billing — staff can
              publish a plan to this same link when ready.
            </p>
          </div>
        ) : null}
      </Card>

      {stmt.paymentPlan && stmt.balanceCents > 0 ? (
        <PatientPaymentPlanAckPanel
          orgSlug={orgSlug}
          token={token}
          plan={{
            id: stmt.paymentPlan.id,
            label: stmt.paymentPlan.label,
            status: stmt.paymentPlan.status,
            installmentCount: stmt.paymentPlan.installmentCount,
            intervalWeeks: stmt.paymentPlan.intervalWeeks,
            patientAcknowledgedAt: stmt.paymentPlan.patientAcknowledgedAt,
            installments: stmt.paymentPlan.installments.map((i) => ({
              sequence: i.sequence,
              dueDate: i.dueDate,
              amountCents: i.amountCents,
              satisfiedCents: i.satisfiedCents,
              status: i.status,
            })),
          }}
        />
      ) : null}

      {stmt.lines.length === 0 ? (
        <Card className="mt-6 border-amber-100 bg-amber-50/50 p-5 shadow-sm">
          <p className="text-sm font-medium text-amber-950">
            No line items on this statement
          </p>
          <p className="mt-2 text-sm text-amber-900/90">
            The balance may still reflect an imported total. If this looks
            wrong, use billing contact information from your paperwork or call
            the number on your statement.
          </p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Charges</h2>
          <p className="mt-1 text-xs text-slate-500">
            Tap &quot;Explain charge&quot; for plain-language education. This is
            not medical or legal advice.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[440px] text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-left"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stmt.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      No charges listed. See notice above if the statement
                      total is unexpected.
                    </td>
                  </tr>
                ) : (
                  stmt.lines.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="py-3 font-mono text-xs">{l.code}</td>
                      <td className="py-3 text-slate-700">{l.description}</td>
                      <td className="py-3 text-right tabular-nums font-medium">
                        {usd(l.amountCents)}
                      </td>
                      <td className="py-3">
                        <StatementLineExplain
                          orgSlug={orgSlug}
                          statementId={stmt.id}
                          lineId={l.id}
                          patientAccessToken={token}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Coverage on file
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            {stmt.patient.coverages.length === 0 ? (
              <li className="text-slate-500">No coverage on file.</li>
            ) : (
              stmt.patient.coverages.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="info">{c.priority}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">
                    {c.payerName}
                    {c.planName ? ` · ${c.planName}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500">
        <Link href={`/p/${encodeURIComponent(orgSlug)}`} className="underline">
          Billing home
        </Link>
      </p>
    </div>
  );
}

function greetingFirstName(firstName: string) {
  return firstName.trim() || "there";
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

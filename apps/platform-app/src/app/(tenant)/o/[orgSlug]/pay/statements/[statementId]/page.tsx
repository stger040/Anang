import { PatientPayLinkCard } from "@/components/patient-pay-link-card";
import { StatementPaymentPlanStaffForm } from "@/components/statement-payment-plan-staff-form";
import { PayWithStripeButton } from "@/components/pay-with-stripe-button";
import { StatementLineExplain } from "@/components/statement-line-explain";
import { CrossModuleActionRow } from "@/components/cross-module-action-row";
import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BillingSmsConsentForms,
  InstallmentMarkPaidRow,
} from "./statement-sms-and-installment-forms";

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; statementId: string }>;
}) {
  const { orgSlug, statementId } = await params;
  const session = await getSession();
  if (!session) notFound();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const stmt = await tenantPrisma(orgSlug).statement.findFirst({
    where: { id: statementId, tenantId: tenant.id },
    include: {
      patient: {
        include: {
          coverages: { orderBy: [{ priority: "asc" }, { id: "asc" }] },
        },
      },
      claim: { select: { id: true, claimNumber: true } },
      encounter: { select: { id: true, dateOfService: true } },
      lines: true,
      payments: true,
      paymentPlan: {
        include: {
          installments: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  if (!stmt) notFound();

  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const fromFhirFixture = isFhirFixtureImportStatementNumber(stmt.number);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Statement ${stmt.number}`}
        description={`${stmt.patient.lastName}, ${stmt.patient.firstName}`}
        actions={
          <Link href={`/o/${orgSlug}/pay`}>
            <Button type="button" variant="secondary" size="sm">
              Back to list
            </Button>
          </Link>
        }
      />

      {stmt.claim ? (
        <Card className="border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Related in other modules
          </p>
          <p className="mt-1 text-sm text-slate-800">
            Patient balance ties to claim{" "}
            <span className="font-mono text-xs">{stmt.claim.claimNumber}</span>
            {stmt.encounter
              ? ` · visit DOS ${stmt.encounter.dateOfService.toLocaleDateString()}`
              : null}
            .
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CrossModuleActionRow
              module={ModuleKey.CONNECT}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/connect/claims/${stmt.claim.id}`}
              variant="primary"
            >
              View related claim in Connect
            </CrossModuleActionRow>
            {stmt.encounter ? (
              <CrossModuleActionRow
                module={ModuleKey.BUILD}
                effectiveModules={ctx.effectiveModules}
                href={`/o/${orgSlug}/build/encounters/${stmt.encounter.id}`}
              >
                View encounter in Build
              </CrossModuleActionRow>
            ) : null}
            <CrossModuleActionRow
              module={ModuleKey.SUPPORT}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/support`}
            >
              Next recommended step: Support
            </CrossModuleActionRow>
            <CrossModuleActionRow
              module={ModuleKey.COVER}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/cover`}
            >
              Affordability path: Cover
            </CrossModuleActionRow>
            <Link href={`/o/${orgSlug}/insight`}>
              <Button type="button" variant="secondary" size="sm">
                Summary module: Insight
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Next recommended step
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Use Support for billing follow-up and Cover for affordability review
            when a patient cannot resolve this balance through standard payment
            options.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/o/${orgSlug}/support`}>
              <Button type="button" variant="primary" size="sm">
                Open Support
              </Button>
            </Link>
            <Link href={`/o/${orgSlug}/cover`}>
              <Button type="button" variant="secondary" size="sm">
                Open Cover
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {fromFhirFixture ? (
        <Card className="border-violet-100 bg-violet-50/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-800">
            FHIR-imported statement
          </p>
          <p className="mt-1 text-sm text-slate-800">
            This balance was created from a pasted FHIR R4 Bundle (Settings →
            Implementation). Line items mirror R4 Claim{" "}
            <span className="font-mono text-xs">item.net</span> when present;
            otherwise a single fallback line is used. Validate against your
            billing source of truth.
          </p>
          <div className="mt-3">
            <Badge tone="default">Verify before production use</Badge>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
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
              {stmt.status.replace("_", " ")}
            </Badge>
            <span className="text-sm text-slate-600">
              Due {stmt.dueDate.toLocaleDateString()}
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-slate-500">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {usd(stmt.totalCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Balance</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {usd(stmt.balanceCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Payments</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {stmt.payments.length}
              </dd>
            </div>
          </dl>

          <h3 className="mt-8 text-sm font-semibold text-slate-900">Lines</h3>
          <p className="mt-1 text-xs text-slate-500">
            Plain-language education per line (Medical AI). With an outbound LLM
            enabled, do not use real PHI unless your vendor path is
            HIPAA-appropriate (see{" "}
            <span className="font-mono">OPENAI_DISABLE_BILL_EXPLAIN</span> /{" "}
            <span className="font-mono">OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD</span>{" "}
            in deployment docs). Not clinical or legal advice.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2 text-left">Education</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stmt.lines.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="py-2 font-mono text-xs">{l.code}</td>
                    <td className="py-2 text-slate-700">{l.description}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {usd(l.amountCents)}
                    </td>
                    <td className="py-2">
                      <StatementLineExplain
                        orgSlug={orgSlug}
                        statementId={statementId}
                        lineId={l.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <BillingSmsConsentForms
            orgSlug={orgSlug}
            statementId={statementId}
            patientId={stmt.patientId}
            optInAt={stmt.patient.billingSmsOptInAt}
            optOutAt={stmt.patient.billingSmsOptOutAt}
          />

          <PatientPayLinkCard
            orgSlug={orgSlug}
            statementId={statementId}
            balanceCents={stmt.balanceCents}
          />

          {stmt.paymentPlan ? (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-medium uppercase text-slate-600">
                Active plan offer
              </p>
              <p className="mt-1 text-sm text-slate-800">
                {stmt.paymentPlan.label} · {stmt.paymentPlan.installmentCount}{" "}
                installments · {stmt.paymentPlan.status}
              </p>
              <ul className="mt-2 max-h-48 space-y-3 overflow-y-auto text-xs text-slate-600">
                {stmt.paymentPlan.installments.map((i) => (
                  <InstallmentMarkPaidRow
                    key={i.id}
                    orgSlug={orgSlug}
                    installmentId={i.id}
                    balanceCents={stmt.balanceCents}
                    amountCents={i.amountCents}
                    satisfiedCents={i.satisfiedCents}
                    status={i.status}
                    sequence={i.sequence}
                    dueDateLabel={i.dueDate.toLocaleDateString(undefined, {
                      dateStyle: "medium",
                    })}
                  />
                ))}
              </ul>
              {stmt.paymentPlan.patientAcknowledgedAt ? (
                <p className="mt-2 text-xs text-emerald-800">
                  Patient acknowledged{" "}
                  {stmt.paymentPlan.patientAcknowledgedAt.toLocaleString()}
                </p>
              ) : null}
            </div>
          ) : null}

          <StatementPaymentPlanStaffForm
            orgSlug={orgSlug}
            statementId={statementId}
            balanceCents={stmt.balanceCents}
          />

          <h3 className="mt-6 text-sm font-semibold text-slate-900">
            Coverage on file
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Canonical payer rows (seed or EHR ingest). Not a coverage
            determination.
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {stmt.patient.coverages.length === 0 ? (
              <li className="text-slate-500">No coverage rows yet.</li>
            ) : (
              stmt.patient.coverages.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="info">{c.priority}</Badge>
                    <Badge tone="default">{c.status}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-slate-900">
                    {c.payerName}
                    {c.planName ? ` · ${c.planName}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {c.memberId ? (
                      <span className="font-mono">Member {c.memberId}</span>
                    ) : (
                      <span>Member id —</span>
                    )}
                    {c.groupNumber ? (
                      <span className="ml-2 font-mono">
                        Group {c.groupNumber}
                      </span>
                    ) : null}
                  </p>
                  {(c.effectiveFrom || c.effectiveTo) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {c.effectiveFrom
                        ? `From ${c.effectiveFrom.toLocaleDateString()}`
                        : ""}
                      {c.effectiveTo
                        ? ` · To ${c.effectiveTo.toLocaleDateString()}`
                        : ""}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>

          {stripeConfigured && stmt.balanceCents > 0 ? (
            <div className="mb-6 rounded-lg border border-teal-100 bg-teal-50/60 p-4">
              <p className="text-xs font-medium text-teal-900">
                Pay online (Stripe test mode)
              </p>
              <p className="mt-1 text-xs text-teal-800/90">
                Uses your platform Stripe keys and webhook — see deployment
                docs.
              </p>
              <div className="mt-3">
                <PayWithStripeButton
                  orgSlug={orgSlug}
                  statementId={statementId}
                />
              </div>
            </div>
          ) : null}
          <div className="mb-6 rounded-lg border border-slate-100 bg-slate-50/90 p-4">
            <p className="text-xs font-medium text-slate-800">Staff shortcuts</p>
            <p className="mt-1 text-xs text-slate-600">
              Jump to Cover or Support with this patient in context.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/o/${orgSlug}/cover?patientId=${stmt.patientId}`}
                className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                New Cover case
              </Link>
              <Link
                href={`/o/${orgSlug}/support`}
                className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                Support queue
              </Link>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-900">
            Payment activity
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {stmt.payments.length === 0 ? (
              <li className="text-slate-500">No payments posted.</li>
            ) : (
              stmt.payments.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                >
                  <p className="font-medium text-slate-900">
                    {usd(p.amountCents)} · {p.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.method ?? "method n/a"}{" "}
                    {p.paidAt ? `· ${p.paidAt.toLocaleDateString()}` : ""}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

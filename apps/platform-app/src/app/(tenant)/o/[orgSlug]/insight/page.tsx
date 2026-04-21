import { tenantPrisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@anang/ui";
import Link from "next/link";

export default async function InsightPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const claims = await tenantPrisma(orgSlug).claim.findMany({ where: { tenantId: tenant.id } });
  const total = claims.length;
  const denied = claims.filter((c) => c.status === "DENIED").length;
  const paid = claims.filter((c) => c.status === "PAID").length;
  const submitted = claims.filter((c) =>
    ["SUBMITTED", "ACCEPTED", "DENIED", "PAID", "APPEALED"].includes(c.status),
  ).length;
  const denialRate = total > 0 ? Math.round((denied / total) * 100) : 0;
  const firstPass =
    submitted > 0 ? Math.round((paid / submitted) * 100) : 0;

  const leakage = claims.reduce((sum, c) => {
    if (c.status === "DENIED" || c.status === "APPEALED") {
      return sum + Math.round(c.billedCents * 0.08);
    }
    return sum;
  }, 0);

  const atRisk = claims.filter((c) =>
    ["DENIED", "APPEALED", "SUBMITTED"].includes(c.status),
  ).length;

  const [stmtBal, fhirFixtureStatementCount] = await Promise.all([
    tenantPrisma(orgSlug).statement.aggregate({
      where: { tenantId: tenant.id },
      _sum: { balanceCents: true },
    }),
    tenantPrisma(orgSlug).statement.count({
      where: {
        tenantId: tenant.id,
        number: { startsWith: "FHIR-" },
      },
    }),
  ]);
  const balance = stmtBal._sum.balanceCents ?? 0;
  const arDays = Math.min(56, 28 + Math.round(balance / 5000000));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Insight — revenue intelligence"
        description="Use Insight after working Build, Connect, Pay, Support, and Cover to summarize operating performance in one place."
      />

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          When to use Insight
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Insight is the recap layer. Typical action: review denial pressure,
          patient AR, and risk indicators after teams execute in other modules.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/o/${orgSlug}/build`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related: Build
          </Link>
          <Link
            href={`/o/${orgSlug}/connect`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related: Connect
          </Link>
          <Link
            href={`/o/${orgSlug}/pay`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related: Pay
          </Link>
          <Link
            href={`/o/${orgSlug}/dashboard`}
            className="rounded-full bg-brand-sky/30 px-2 py-1 font-medium text-brand-navy"
          >
            Next demo step: Start Here recap
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Denial rate"
          value={`${denialRate}%`}
          hint="Current claim mix for this tenant"
        />
        <StatCard
          label="First-pass clean paid (proxy)"
          value={`${firstPass}%`}
          hint="Paid / submitted proxy until remittance warehouse exists"
        />
        <StatCard
          label="Revenue leakage signal"
          value={usd(leakage)}
          hint="8% of denied/appealed billed (illustrative)"
        />
        <StatCard
          label="AR days (illustrative)"
          value={`${arDays}d`}
          hint="Blended heuristic until ledger integration"
        />
        <StatCard
          label="Claims at risk"
          value={String(atRisk)}
          hint="Submitted + denied + appealed buckets"
        />
        <StatCard
          label="Statements open balance"
          value={usd(stmtBal._sum.balanceCents ?? 0)}
          hint={
            fhirFixtureStatementCount > 0
              ? `Patient AR from Pay · ${fhirFixtureStatementCount} statement(s) from FHIR bundle import (FHIR-… numbers)`
              : "Patient AR from Pay"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Denial taxonomy
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Payer denial rollups and CARC/RARC groupings will appear here after
            remittance and claim-status data are integrated.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent trends (chart — upcoming)
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Wire to your charting library once time-series metrics are available
            from your warehouse.
          </p>
          <div className="mt-6 h-40 rounded-lg border border-dashed border-slate-200 bg-gradient-to-tr from-brand-sky/80 to-white" />
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

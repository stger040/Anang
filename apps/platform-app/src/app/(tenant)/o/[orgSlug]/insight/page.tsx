import { CrossModuleChip } from "@/components/cross-module-chip";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { Card, PageHeader, StatCard } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";

export default async function InsightPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) return null;
  const { ctx, operational, fullSuiteDashboard } = w;

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

  const showWorkspaceHome =
    operational.length > 1 || fullSuiteDashboard;
  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Operational KPIs for this tenant — tuned for a focused module set."
      : "Use Insight after working Build, Connect, Pay, Support, and Cover to summarize operating performance in one place.";

  return (
    <div className="space-y-8">
      <PageHeader title="Insight — revenue intelligence" description={subtitle} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Insight is the read-only rollup: denial pressure, balances, and risk
            signals so leaders can see how operations are trending without opening
            every transactional screen.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Scan denial rate and claims at risk before standups.</li>
            <li>Pair AR signals with what teams are doing in Pay and Connect.</li>
            <li>Use this page as the “answer in one place” view for leadership demos.</li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ctx.effectiveModules.has(ModuleKey.CONNECT) ? (
              <li>
                <Link
                  href={`/o/${orgSlug}/connect`}
                  className="font-medium text-brand-navy underline"
                >
                  Open Connect for claim drill-down
                </Link>
              </li>
            ) : null}
            {ctx.effectiveModules.has(ModuleKey.PAY) ? (
              <li>
                <Link href={`/o/${orgSlug}/pay`} className="font-medium text-brand-navy underline">
                  Open Pay for statement detail
                </Link>
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Cross-module context</h2>
        <p className="mt-1 text-sm text-slate-700">
          Metrics here summarize work that happens in other modules. Chips link only
          when you have access.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.BUILD} effectiveModules={ctx.effectiveModules}>
            Related: Build
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.CONNECT}
            effectiveModules={ctx.effectiveModules}
          >
            Related: Connect
          </CrossModuleChip>
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.PAY} effectiveModules={ctx.effectiveModules}>
            Related: Pay
          </CrossModuleChip>
          {showWorkspaceHome ? (
            <Link
              href={`/o/${orgSlug}/dashboard`}
              className="inline-flex items-center rounded-full border border-brand-sky/50 bg-brand-sky/30 px-2 py-1 text-xs font-medium text-brand-navy hover:bg-brand-sky/40"
            >
              {fullSuiteDashboard
                ? "Demo: Start Here recap"
                : "Workspace home"}
            </Link>
          ) : (
            <span className="inline-flex max-w-full items-center rounded-full border border-dashed border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
              Multi-module workspace home is hidden when Insight is your only
              module — you are already on the right home surface.
            </span>
          )}
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

import { CrossModuleChip } from "@/components/cross-module-chip";
import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";

export default async function PayStatementsPage({
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

  const statements = await tenantPrisma(orgSlug).statement.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dueDate: "desc" },
    include: { patient: true, payments: true },
  });

  const patients = await tenantPrisma(orgSlug).patient.findMany({
    where: { tenantId: tenant.id },
    orderBy: { lastName: "asc" },
    take: 12,
  });

  const openStatements = statements.filter((s) => s.status === "open");
  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Statements, balances, and patient-facing payment flows for your role."
      : "Use Pay after claims adjudication to manage patient responsibility. Typical actions: open statement detail, explain line items, send patient pay links, and coordinate follow-up with Support or Cover.";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pay — patient financials"
        description={subtitle}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Pay is where staff explain what the patient owes, collect balances,
            and configure pre-visit flows. Claim status itself stays in Connect;
            affordability programs often sit in Cover.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Work down open statements with a balance due.</li>
            <li>Send or verify patient pay links where appropriate.</li>
            <li>Escalate affordability to Cover or callbacks to Support when needed.</li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <p className="mt-2 text-xs text-slate-600">
            {openStatements.length} open statement
            {openStatements.length === 1 ? "" : "s"} with balance.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {statements[0] ? (
              <li>
                <Link
                  href={`/o/${orgSlug}/pay/statements/${statements[0].id}`}
                  className="font-medium text-brand-navy underline"
                >
                  Open most recent statement
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={`/o/${orgSlug}/pay/pre`} className="text-xs font-medium text-brand-navy underline">
                Pre-visit hub
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Handoffs</h2>
        <p className="mt-1 text-sm text-slate-700">
          Payer outcomes and remits are visible in Connect. Patient questions after
          a statement often land in Support; charity or assistance workflows may
          be owned in Cover.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.CONNECT}
            effectiveModules={ctx.effectiveModules}
          >
            Claim context: Connect
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.SUPPORT}
            effectiveModules={ctx.effectiveModules}
            emphasis
          >
            Follow-up: Support
          </CrossModuleChip>
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.COVER} effectiveModules={ctx.effectiveModules}>
            Affordability: Cover
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.INSIGHT}
            effectiveModules={ctx.effectiveModules}
          >
            Rollup: Insight
          </CrossModuleChip>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-3 border-teal-100 bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Pre-visit &amp; estimates (Pay + Pre)
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Deposits, GFE-aware flows, and appointment hooks — same Pay module,
                staff configuration surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/o/${orgSlug}/pay/patient-preview`}>
                <Button type="button" size="sm" variant="secondary">
                  Patient experience preview
                </Button>
              </Link>
              <Link href={`/o/${orgSlug}/pay/pre`}>
                <Button type="button" size="sm" variant="primary">
                  Open pre-visit hub
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Statements</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs">{s.number}</span>
                        {isFhirFixtureImportStatementNumber(s.number) ? (
                          <Badge tone="default">FHIR</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {s.patient.lastName}, {s.patient.firstName}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-slate-700">
                      {usd(s.totalCents)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums font-medium text-slate-900">
                      {usd(s.balanceCents)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        tone={
                          s.status === "open"
                            ? "warning"
                            : s.status === "paid"
                              ? "success"
                              : "default"
                        }
                      >
                        {s.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {s.dueDate.toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Link href={`/o/${orgSlug}/pay/statements/${s.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Open statement
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Patient lookup
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Mock directory — future: typeahead against MPI / registration index.
          </p>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {patients.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-900">
                  {p.lastName}, {p.firstName}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {p.mrn ?? p.id.slice(0, 8)}
                </span>
              </li>
            ))}
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

import { CrossModuleChip } from "@/components/cross-module-chip";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { Card, PageHeader } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import { CoverWorkspace } from "./cover-workspace";

export default async function CoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ patientId?: string }>;
}) {
  const { orgSlug } = await params;
  const { patientId: patientIdParam } = await searchParams;

  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) return null;
  const { ctx, operational, fullSuiteDashboard } = w;

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const [patients, cases] = await Promise.all([
    tenantPrisma(orgSlug).patient.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 80,
    }),
    tenantPrisma(orgSlug).coverAssistanceCase.findMany({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      include: { patient: true },
    }),
  ]);

  const patientOptions = patients.map((p) => ({
    id: p.id,
    label: `${p.lastName}, ${p.firstName}${p.mrn ? ` · ${p.mrn}` : ""}`,
  }));

  const defaultPatientId =
    patientIdParam && patients.some((p) => p.id === patientIdParam)
      ? patientIdParam
      : undefined;

  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Financial assistance, coverage routing, and charity-care style review."
      : "Use Cover when a patient needs affordability help, coverage routing, or financial-assistance review. This module is patient-centered and complements Pay/Support follow-up.";

  const activeCases = cases.filter((c) => c.status !== "closed").slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader title="Cover — affordability & coverage" description={subtitle} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Cover is where staff screen for assistance programs, document household
            context, and route patients to the right coverage or charity pathway.
            It is intentionally separate from day-to-day statement work in Pay.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Pick up in-progress cases waiting on documentation.</li>
            <li>Close loops on eligibility questions before balances go back to Pay.</li>
            <li>Coordinate with Support when the patient is mid-conversation.</li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <p className="mt-2 text-xs text-slate-600">
            {cases.length} case{cases.length === 1 ? "" : "s"} on file.
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Use the workspace below to add or update a case.</li>
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Handoffs</h2>
        <p className="mt-1 text-sm text-slate-700">
          Balances and statements are owned in Pay. Billing callbacks may start in
          Support before a case lands here.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.PAY} effectiveModules={ctx.effectiveModules}>
            Balances: Pay
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.SUPPORT}
            effectiveModules={ctx.effectiveModules}
          >
            Callbacks: Support
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.INSIGHT}
            effectiveModules={ctx.effectiveModules}
            emphasis
          >
            Rollup: Insight
          </CrossModuleChip>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Recent / assigned work</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {activeCases.length === 0 ? (
            <li className="py-2 text-slate-600">No active cases.</li>
          ) : (
            activeCases.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-medium text-slate-900">
                  {c.patient.lastName}, {c.patient.firstName}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {c.track} · {c.status.replaceAll("_", " ")}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
      <CoverWorkspace
        orgSlug={orgSlug}
        patients={patientOptions}
        cases={cases.map((c) => ({
          id: c.id,
          track: c.track,
          status: c.status,
          householdSize: c.householdSize,
          annualIncomeCents: c.annualIncomeCents,
          notes: c.notes,
          updatedAt: c.updatedAt,
          patient: c.patient,
        }))}
        defaultPatientId={defaultPatientId}
      />
    </div>
  );
}

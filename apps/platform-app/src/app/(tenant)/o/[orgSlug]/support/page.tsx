import { CrossModuleChip } from "@/components/cross-module-chip";
import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";
import { Card, PageHeader } from "@anang/ui";
import { SupportAssistantPanel } from "./support-assistant-panel";
import { SupportWorkspace } from "./support-workspace";

export default async function SupportPage({
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

  const [patients, statements, tasks] = await Promise.all([
    tenantPrisma(orgSlug).patient.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 80,
    }),
    tenantPrisma(orgSlug).statement.findMany({
      where: { tenantId: tenant.id },
      orderBy: { dueDate: "desc" },
      take: 40,
      select: { id: true, number: true, balanceCents: true },
    }),
    tenantPrisma(orgSlug).supportTask.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: { patient: true, statement: true },
    }),
  ]);

  const openCount = tasks.filter((t) => t.status === "open").length;
  const urgentOpen = tasks.filter(
    (t) => t.status === "open" && t.priority === "urgent",
  ).length;

  const patientOptions = patients.map((p) => ({
    id: p.id,
    label: `${p.lastName}, ${p.firstName}${p.mrn ? ` · ${p.mrn}` : ""}`,
  }));

  const statementOptions = statements.map((s) => {
    const fhirFixture = isFhirFixtureImportStatementNumber(s.number);
    return {
      id: s.id,
      label: `${s.number} · ${usd(s.balanceCents)} bal${fhirFixture ? " · FHIR import" : ""}`,
    };
  });

  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Billing callbacks and tasks after statements go out — focused on your queue."
      : "Use Support for post-statement follow-up. Typical actions: open a billing task, reference the statement, update status, and route affordability requests to Cover.";

  const recentOpen = tasks.filter((t) => t.status === "open").slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader title="Support — operations workspace" description={subtitle} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Support is the staff queue for patient billing questions, payment-plan
            follow-up, and callbacks. Statements are authored in Pay; this module
            is where you work the conversation to resolution.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Clear urgent open tasks first.</li>
            <li>Link each task to the right statement when one exists.</li>
            <li>Move financial assistance questions toward Cover when that team owns it.</li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <p className="mt-2 text-xs text-slate-600">
            {openCount} open task{openCount === 1 ? "" : "s"}
            {urgentOpen ? ` · ${urgentOpen} urgent` : ""}.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-slate-700">Use the workspace below to filter and update tasks.</span>
            </li>
            {statements[0] && ctx.effectiveModules.has(ModuleKey.PAY) ? (
              <li>
                <Link
                  href={`/o/${orgSlug}/pay/statements/${statements[0].id}`}
                  className="font-medium text-brand-navy underline"
                >
                  Open a recent statement
                </Link>
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Handoffs</h2>
        <p className="mt-1 text-sm text-slate-700">
          Statements and balances are prepared in Pay. Claim status questions are
          answered in Connect. Affordability cases may be tracked in Cover.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.PAY} effectiveModules={ctx.effectiveModules}>
            Upstream: Pay
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.COVER}
            effectiveModules={ctx.effectiveModules}
            emphasis
          >
            Escalations: Cover
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

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">Recent / assigned work</h2>
        <p className="mt-1 text-xs text-slate-500">
          Open tasks, soonest due first — full tools in the panel below.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {recentOpen.length === 0 ? (
            <li className="py-2 text-slate-600">No open tasks.</li>
          ) : (
            recentOpen.map((t) => (
              <li key={t.id} className="flex flex-col gap-0.5 py-2">
                <span className="font-medium text-slate-900">{t.title}</span>
                <span className="text-xs text-slate-500">
                  {t.patient
                    ? `${t.patient.lastName}, ${t.patient.firstName}`
                    : "No patient"}{" "}
                  · {t.priority} · due{" "}
                  {t.dueAt ? t.dueAt.toLocaleDateString() : "—"}
                </span>
              </li>
            ))
          )}
        </ul>
      </Card>
      <SupportAssistantPanel
        orgSlug={orgSlug}
        openTaskCount={openCount}
        urgentOpenCount={urgentOpen}
      />
      <SupportWorkspace
        orgSlug={orgSlug}
        patients={patientOptions}
        statements={statementOptions}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          detail: t.detail,
          status: t.status,
          priority: t.priority,
          category: t.category,
          dueAt: t.dueAt,
          patient: t.patient,
          statement: t.statement
            ? {
                number: t.statement.number,
                fhirFixture: isFhirFixtureImportStatementNumber(
                  t.statement.number,
                ),
              }
            : null,
        }))}
      />
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

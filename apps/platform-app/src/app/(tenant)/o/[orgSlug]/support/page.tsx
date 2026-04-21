import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@anang/ui";
import { SupportAssistantPanel } from "./support-assistant-panel";
import { SupportWorkspace } from "./support-workspace";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support — operations workspace"
        description="Use Support for post-statement follow-up. Typical actions: open a billing task, reference the statement, update status, and route affordability requests to Cover."
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          When to use Support
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          This queue handles patient billing questions, payment-plan follow-up,
          and callbacks after a statement is sent from Pay.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/o/${orgSlug}/pay`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related module: Pay
          </Link>
          <Link
            href={`/o/${orgSlug}/cover`}
            className="rounded-full bg-brand-sky/30 px-2 py-1 font-medium text-brand-navy"
          >
            Next if affordability needed: Cover
          </Link>
          <Link
            href={`/o/${orgSlug}/insight`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Summary module: Insight
          </Link>
        </div>
      </div>
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

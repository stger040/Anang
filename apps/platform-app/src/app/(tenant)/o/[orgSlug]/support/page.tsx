import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
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
        description="Queues for billing follow-up, payment plans, and escalations. Add ticketing or voice when you need full CRM depth."
      />
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

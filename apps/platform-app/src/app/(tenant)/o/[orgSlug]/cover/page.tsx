import { PageHeader } from "@anang/ui";
import { prisma } from "@/lib/prisma";
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

  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const [patients, cases] = await Promise.all([
    prisma.patient.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 80,
    }),
    prisma.coverAssistanceCase.findMany({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cover — affordability & coverage"
        description="Financial assistance, marketplace / Medicaid routing, and charity-care intake. Staff workspace below; patient self-service lands on the future patient app + SMS journeys."
      />
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

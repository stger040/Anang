import { PageHeader } from "@anang/ui";
import { tenantPrisma } from "@/lib/prisma";
import Link from "next/link";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cover — affordability & coverage"
        description="Use Cover when a patient needs affordability help, coverage routing, or financial-assistance review. This module is patient-centered and complements Pay/Support follow-up."
      />
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          What Cover is for
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          Cover is the affordability workflow: financial assistance, Medicaid or
          marketplace routing, and charity-care screening. Use it when a patient
          cannot resolve balance through standard Pay/Support steps.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/o/${orgSlug}/pay`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related module: Pay
          </Link>
          <Link
            href={`/o/${orgSlug}/support`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related module: Support
          </Link>
          <Link
            href={`/o/${orgSlug}/insight`}
            className="rounded-full bg-brand-sky/30 px-2 py-1 font-medium text-brand-navy"
          >
            Next related module: Insight
          </Link>
        </div>
      </div>
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

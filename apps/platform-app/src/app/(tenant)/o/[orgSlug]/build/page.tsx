import { parseFhirVisitSummaryMeta } from "@/lib/fhir-visit-summary-meta";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

export default async function BuildQueuePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const encounters = await prisma.encounter.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dateOfService: "desc" },
    include: {
      patient: true,
      drafts: { take: 1, orderBy: { id: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build — encounter queue"
        description="AI-assisted claims preparation with documentation gaps, denial risk signals, and human approval before submission."
        actions={
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Rules + retrieval today · payer policy models ship with your rulesets
          </span>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">DOS</th>
                <th className="px-4 py-3">Chief complaint</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Draft</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {encounters.map((e) => {
                const d = e.drafts[0];
                const fixtureMeta = parseFhirVisitSummaryMeta(e.visitSummary);
                return (
                  <tr key={e.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {e.patient.lastName}, {e.patient.firstName}
                      <div className="text-xs font-normal text-slate-500">
                        MRN {e.patient.mrn ?? "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {e.dateOfService.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {e.chiefComplaint ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {fixtureMeta.isFhirFixtureImport ? (
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone="default">FHIR import</Badge>
                          {fixtureMeta.explanationOfBenefitResourceCount !=
                          null ? (
                            <Badge tone="info">
                              EOB × {fixtureMeta.explanationOfBenefitResourceCount}
                            </Badge>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          e.reviewStatus === "approved"
                            ? "success"
                            : e.reviewStatus === "in_review"
                              ? "warning"
                              : "default"
                        }
                      >
                        {e.reviewStatus.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {d ? (
                        <Badge tone="info">{d.status}</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/o/${orgSlug}/build/encounters/${e.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Open
                        </Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {encounters.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No encounters seeded for this tenant.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

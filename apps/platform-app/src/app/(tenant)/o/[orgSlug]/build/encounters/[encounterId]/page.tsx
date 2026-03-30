import { approveClaimDraft } from "../../actions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, PageHeader } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EncounterDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; encounterId: string }>;
}) {
  const { orgSlug, encounterId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, tenantId: tenant.id },
    include: {
      patient: true,
      drafts: {
        orderBy: { id: "desc" },
        include: { lines: true, issues: true },
      },
    },
  });
  if (!encounter) notFound();

  const draft = encounter.drafts[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Encounter — claims build"
        description={`${encounter.patient.lastName}, ${encounter.patient.firstName} · DOS ${encounter.dateOfService.toLocaleDateString()}`}
        actions={
          <Link href={`/o/${orgSlug}/build`}>
            <Button type="button" variant="secondary" size="sm">
              Back to queue
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Clinical note (synthetic)
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {encounter.visitSummary}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Future: ingest from HL7/FHIR or vendor SDK; today this string seeds
            the AI code & risk layers for demos.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Patient</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">
                {encounter.patient.firstName} {encounter.patient.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">MRN</dt>
              <dd className="font-mono text-slate-800">
                {encounter.patient.mrn ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">DOB</dt>
              <dd className="text-slate-800">
                {encounter.patient.dob
                  ? encounter.patient.dob.toLocaleDateString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {draft ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                AI code suggestions
              </h2>
              <ul className="mt-4 space-y-4">
                {draft.lines.map((line) => (
                  <li
                    key={line.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="teal">CPT {line.cpt}</Badge>
                      <Badge tone="info">ICD-10 {line.icd10}</Badge>
                      {line.modifier ? (
                        <Badge tone="default">Mod {line.modifier}</Badge>
                      ) : null}
                      <span className="text-xs text-slate-500">
                        {line.units} unit(s) ·{" "}
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(line.chargeCents / 100)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Why suggested
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {line.aiRationale}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Risk & documentation
              </h2>
              <ul className="mt-4 space-y-3">
                {draft.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          issue.severity === "critical"
                            ? "danger"
                            : issue.severity === "warning"
                              ? "warning"
                              : "default"
                        }
                      >
                        {issue.severity}
                      </Badge>
                      <Badge tone="info">{issue.category.replace("_", " ")}</Badge>
                    </div>
                    <p className="mt-2 font-medium text-slate-900">
                      {issue.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{issue.detail}</p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Explainability
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {issue.explainability}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Human review
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Approving locks the draft as submission-ready in this demo. A
                  production path would enqueue 837 generation and attach
                  evidence packets for high-risk edits.
                </p>
              </div>
              <form action={approveClaimDraft} className="flex flex-col gap-2">
                <input type="hidden" name="draftId" value={draft.id} />
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <Button
                  type="submit"
                  disabled={draft.status === "ready" || draft.status === "submitted_mock"}
                >
                  {draft.status === "ready"
                    ? "Approved"
                    : "Approve claim draft"}
                </Button>
              </form>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Submission-ready claim draft (preview)
            </h2>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
              {JSON.stringify(
                {
                  draftId: draft.id,
                  status: draft.status,
                  lines: draft.lines.map((l) => ({
                    cpt: l.cpt,
                    icd10: l.icd10,
                    modifier: l.modifier,
                    units: l.units,
                    chargeUsd: l.chargeCents / 100,
                  })),
                  issuesOutstanding: draft.issues.filter(
                    (i) => i.severity === "critical",
                  ).length,
                },
                null,
                2,
              )}
            </pre>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-500">
          No draft linked — seed data may be incomplete.
        </Card>
      )}
    </div>
  );
}

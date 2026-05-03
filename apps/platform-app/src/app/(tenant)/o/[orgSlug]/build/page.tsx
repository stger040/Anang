import { CrossModuleChip } from "@/components/cross-module-chip";
import { isBuildAiTestingEnabled } from "@/lib/build/build-ai-env";
import { parseFhirVisitSummaryMeta } from "@/lib/fhir-visit-summary-meta";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
import Link from "next/link";

export default async function BuildQueuePage({
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

  const encounters = await tenantPrisma(orgSlug).encounter.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dateOfService: "desc" },
    include: {
      patient: true,
      drafts: { take: 1, orderBy: { id: "desc" } },
    },
  });

  const buildAiOn = isBuildAiTestingEnabled();
  const pendingReview = encounters.filter((e) => e.reviewStatus !== "approved");
  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Coding-ready review: encounters, drafts, and approval before anything hits the payer."
      : "Use Build when a visit is ready for coding review. Typical actions: verify encounter note, review draft lines, resolve issues, and approve the draft before Connect lifecycle tracking.";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Build — encounter queue"
        description={subtitle}
        actions={
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            Rules + retrieval today · payer policy models ship with your rulesets
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Build is where clinical documentation becomes a clean claim draft:
            codes, charges, rule findings, and approval. You can complete your
            work here without leaving for payer status — that is Connect’s job.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Clear encounters still in review or waiting on draft fixes.</li>
            <li>Approve drafts that are ready so the claim can be submitted.</li>
            <li>Use per-row review to work the note, lines, and issues in one place.</li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <p className="mt-2 text-xs text-slate-600">
            {pendingReview.length} encounter{pendingReview.length === 1 ? "" : "s"} not fully approved.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {encounters[0] ? (
              <li>
                <Link
                  href={`/o/${orgSlug}/build/encounters/${encounters[0].id}`}
                  className="font-medium text-brand-navy underline"
                >
                  Open most recent encounter
                </Link>
              </li>
            ) : null}
            <li>
              <Link href={`/o/${orgSlug}/build`} className="text-xs text-slate-600 underline">
                Refresh queue
              </Link>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Handoffs</h2>
        <p className="mt-1 text-sm text-slate-700">
          After approval, payer submission and remittance context are tracked in
          Connect. Patient balances and follow-up live in Pay and Support when
          your org uses those modules.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.CONNECT}
            effectiveModules={ctx.effectiveModules}
            emphasis
          >
            Next often: Connect
          </CrossModuleChip>
          <CrossModuleChip orgSlug={orgSlug} targetModule={ModuleKey.PAY} effectiveModules={ctx.effectiveModules}>
            Balances: Pay
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.SUPPORT}
            effectiveModules={ctx.effectiveModules}
          >
            Billing questions: Support
          </CrossModuleChip>
        </div>
      </Card>

      {buildAiOn ? (
        <Card className="border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold text-amber-950">
            Build AI (testing) is enabled on this deployment
          </p>
          <p className="mt-2 text-sm text-amber-950/90">
            Open any encounter below with{" "}
            <span className="font-medium">Review encounter and draft</span> —
            that page has the clinical note, claim lines, rule findings, and
            buttons to clear lines, create a blank draft, or{" "}
            <span className="font-medium">Suggest draft from encounter</span>.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-700">
          <span className="font-medium text-slate-900">Next step</span>
          <span className="text-slate-600">
            {" "}
            — use <span className="font-medium">Review encounter and draft</span>{" "}
            on a row to work the claim (codes, charges, rules, approval
            {buildAiOn ? ", Build AI" : ""}).
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 w-[200px]">Actions</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">DOS</th>
                <th className="px-4 py-3">Chief complaint</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Draft</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {encounters.map((e) => {
                const d = e.drafts[0];
                const fixtureMeta = parseFhirVisitSummaryMeta(e.visitSummary);
                const encUrl = `/o/${orgSlug}/build/encounters/${e.id}`;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 align-top">
                      <Link href={encUrl} className="inline-flex">
                        <Button type="button" size="sm">
                          Review encounter &amp; draft
                        </Button>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link
                        href={encUrl}
                        className="text-brand-navy underline decoration-slate-300 underline-offset-2 hover:decoration-brand-navy"
                      >
                        {e.patient.lastName}, {e.patient.firstName}
                      </Link>
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

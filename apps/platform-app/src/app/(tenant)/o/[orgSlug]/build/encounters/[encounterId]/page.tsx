import { approveClaimDraft } from "../../actions";
import { BuildAiTestingPanel } from "./build-ai-testing-panel";
import { Preview837pForm } from "./preview-837p-form";
import { isBuildAiTestingEnabled } from "@/lib/build/build-ai-env";
import {
  cptExternalLookupUrl,
  displayCptDescriptor,
  displayIcd10Descriptor,
  icd10ExternalLookupUrl,
} from "@/lib/build/code-reference";
import { syncClaimDraftRuleIssues } from "@/lib/build/sync-draft-rules";
import { parseFhirVisitSummaryMeta } from "@/lib/fhir-visit-summary-meta";
import { CrossModuleActionRow } from "@/components/cross-module-action-row";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { Badge, Button, Card, PageHeader } from "@anang/ui";
import { ClaimDraftLineSource, ModuleKey } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

type IssueCitation = {
  chunkId?: string;
  title?: string;
  excerpt?: string;
  sourceLabel?: string | null;
};

function buildActivityBadgeTone(
  eventType: string,
): "default" | "teal" | "info" | "warning" {
  if (eventType === "draft_approved") return "teal";
  if (eventType === "ai_suggestion_applied") return "info";
  if (eventType === "draft_lines_cleared_test") return "warning";
  return "default";
}

function buildActivityLabel(eventType: string): string {
  return eventType.replaceAll("_", " ");
}

function issueCitationsFromJson(value: unknown): IssueCitation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is IssueCitation =>
      x != null &&
      typeof x === "object" &&
      typeof (x as IssueCitation).excerpt === "string",
  );
}

export default async function EncounterDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; encounterId: string }>;
}) {
  const { orgSlug, encounterId } = await params;
  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) notFound();
  const { ctx } = w;

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  let encounter = await tenantPrisma(orgSlug).encounter.findFirst({
    where: { id: encounterId, tenantId: tenant.id },
    include: {
      patient: true,
      drafts: {
        orderBy: { id: "desc" },
        include: {
          lines: true,
          issues: true,
          submittedClaim: { select: { id: true, claimNumber: true } },
          buildDraftEvents: { orderBy: { createdAt: "desc" }, take: 30 },
          buildSuggestionRuns: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              model: true,
              promptVersion: true,
              status: true,
              createdAt: true,
              errorMessage: true,
            },
          },
        },
      },
    },
  });
  if (!encounter) notFound();

  const buildAiTestingEnabled = isBuildAiTestingEnabled();

  const firstDraft = encounter.drafts[0];
  if (firstDraft) {
    await syncClaimDraftRuleIssues(tenantPrisma(orgSlug), {
      tenantId: tenant.id,
      draftId: firstDraft.id,
    });
    const refreshed = await tenantPrisma(orgSlug).encounter.findFirst({
      where: { id: encounterId, tenantId: tenant.id },
      include: {
        patient: true,
        drafts: {
          orderBy: { id: "desc" },
          include: {
            lines: true,
            issues: true,
            submittedClaim: { select: { id: true, claimNumber: true } },
            buildDraftEvents: { orderBy: { createdAt: "desc" }, take: 30 },
            buildSuggestionRuns: {
              orderBy: { createdAt: "desc" },
              take: 5,
              select: {
                id: true,
                model: true,
                promptVersion: true,
                status: true,
                createdAt: true,
                errorMessage: true,
              },
            },
          },
        },
      },
    });
    if (!refreshed) notFound();
    encounter = refreshed;
  }

  const draft = encounter.drafts[0];
  const submittedFromDrafts = encounter.drafts
    .map((d) => d.submittedClaim)
    .find((c) => c != null);
  const fixtureMeta = parseFhirVisitSummaryMeta(encounter.visitSummary);

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

      {submittedFromDrafts ? (
        <Card className="border-teal-200 bg-teal-50/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">
            Related in other modules
          </p>
          <p className="mt-1 text-sm text-slate-800">
            This visit has a claim produced from Build (claim{" "}
            <span className="font-mono text-xs">
              {submittedFromDrafts.claimNumber}
            </span>
            ).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CrossModuleActionRow
              module={ModuleKey.CONNECT}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/connect/claims/${submittedFromDrafts.id}`}
              variant="primary"
            >
              View related claim in Connect
            </CrossModuleActionRow>
            <CrossModuleActionRow
              module={ModuleKey.PAY}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/pay`}
            >
              Next recommended step: Pay
            </CrossModuleActionRow>
          </div>
        </Card>
      ) : (
        <Card className="border-slate-200 bg-slate-50/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Next recommended step
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Approve and submit this draft from Build. Once a claim is created,
            continue in Connect to track lifecycle milestones.
          </p>
          <div className="mt-3">
            <CrossModuleActionRow
              module={ModuleKey.CONNECT}
              effectiveModules={ctx.effectiveModules}
              href={`/o/${orgSlug}/connect`}
            >
              Open Connect workspace
            </CrossModuleActionRow>
          </div>
        </Card>
      )}

      {fixtureMeta.isFhirFixtureImport ? (
        <Card className="border-violet-100 bg-violet-50/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-violet-800">
            FHIR import
          </p>
          <p className="mt-1 text-sm text-slate-800">
            This visit was loaded from a pasted FHIR R4 Bundle. Pay statement
            lines, if any, come from Claim resources in that bundle.
            ExplanationOfBenefit resources in the bundle are summarized below
            for reference; operational 835 handling is a separate integration
            path.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone="default">FHIR R4</Badge>
            {fixtureMeta.explanationOfBenefitResourceCount != null ? (
              <Badge tone="info">
                EOB trace · {fixtureMeta.explanationOfBenefitResourceCount}{" "}
                resource
                {fixtureMeta.explanationOfBenefitResourceCount === 1
                  ? ""
                  : "s"}
              </Badge>
            ) : (
              <Badge tone="default">No EOB in bundle</Badge>
            )}
          </div>
        </Card>
      ) : null}

      {buildAiTestingEnabled ? (
        <Card className="border-amber-100 bg-amber-50/40 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900">
            Build AI — testing mode
          </p>
          <p className="mt-1 text-sm text-slate-800">
            The model proposes ICD-10 / CPT / modifiers / units / rationale only.
            Dollar amounts come from the synthetic{" "}
            <span className="font-mono text-xs">FeeSchedule</span> for this
            tenant (see docs/BUILD_AI_TESTING.md). Imported workbook lines are
            labeled{" "}
            <Badge tone="default" className="align-middle">
              IMPORTED
            </Badge>
            ; AI-applied rows are{" "}
            <Badge tone="info" className="align-middle">
              AI SUGGESTION
            </Badge>
            .
          </p>
          <div className="mt-4">
            <BuildAiTestingPanel
              orgSlug={orgSlug}
              encounterId={encounter.id}
              draftId={draft?.id ?? null}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Clinical note (seed / EHR)
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {encounter.visitSummary}
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Future: ingest from HL7/FHIR or vendor SDK; today this string seeds
            the AI code & risk layers.
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
                Draft charge lines
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Source badges distinguish synthetic import data from Build AI
                testing runs. Code titles use the assistant output when present,
                then a small in-app reference list — staff must still confirm
                against your code book or payer policy.
              </p>
              {draft.buildSuggestionRuns.length > 0 ? (
                <div className="mt-3 rounded-md border border-slate-100 bg-white/80 p-3 text-xs text-slate-700">
                  <p className="font-medium text-slate-900">
                    Recent suggestion runs (audit)
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {draft.buildSuggestionRuns.map((run) => (
                      <li key={run.id}>
                        <span className="font-mono text-[10px] text-slate-500">
                          {run.createdAt.toLocaleString()}
                        </span>{" "}
                        <span className="font-medium">{run.status}</span> ·{" "}
                        {run.model} · {run.promptVersion}
                        {run.errorMessage ? (
                          <span className="block text-red-700">
                            {run.errorMessage}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ul className="mt-4 space-y-4">
                {draft.lines.map((line) => {
                  const icdTitle = displayIcd10Descriptor({
                    icd10: line.icd10,
                    persisted: line.icd10Descriptor,
                  });
                  const cptTitle = displayCptDescriptor({
                    cpt: line.cpt,
                    persisted: line.cptDescriptor,
                  });
                  return (
                  <li
                    key={line.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/80 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          line.lineSource === ClaimDraftLineSource.AI_SUGGESTION
                            ? "info"
                            : "default"
                        }
                      >
                        {line.lineSource === ClaimDraftLineSource.AI_SUGGESTION
                          ? "AI suggestion"
                          : "Imported"}
                      </Badge>
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
                    <dl className="mt-3 space-y-2 border-t border-slate-200/80 pt-3 text-sm">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          ICD-10 title
                        </dt>
                        <dd className="mt-0.5 text-slate-800">
                          {icdTitle ?? (
                            <span className="text-slate-500">
                              No short title on file — use lookup.
                            </span>
                          )}
                          {" · "}
                          <a
                            href={icd10ExternalLookupUrl(line.icd10)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-navy underline"
                          >
                            NIH ICD-10-CM search
                          </a>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          CPT / HCPCS title
                        </dt>
                        <dd className="mt-0.5 text-slate-800">
                          {cptTitle ?? (
                            <span className="text-slate-500">
                              No short title on file — use lookup.
                            </span>
                          )}
                          {" · "}
                          <a
                            href={cptExternalLookupUrl(line.cpt)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-navy underline"
                          >
                            External CPT reference
                          </a>
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Why suggested (this encounter)
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {line.aiRationale}
                    </p>
                  </li>
                );
                })}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Risk & documentation
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Deterministic rule findings refresh on each visit; seed-sourced
                rows use the{" "}
                <span className="font-medium text-slate-600">SEED</span> label.
              </p>
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
                      {issue.issueSource ? (
                        <Badge tone="default">{issue.issueSource}</Badge>
                      ) : null}
                      {issue.ruleKey ? (
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                          {issue.ruleKey}
                        </code>
                      ) : null}
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
                    {(() => {
                      const cites = issueCitationsFromJson(issue.citations);
                      if (cites.length === 0) return null;
                      return (
                        <div className="mt-3 rounded-md border border-teal-100 bg-teal-50/40 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-teal-900">
                            Retrieval citations
                          </p>
                          <ul className="mt-2 space-y-2">
                            {cites.map((c, idx) => (
                              <li key={c.chunkId ?? idx} className="text-sm">
                                <span className="font-medium text-slate-900">
                                  {c.title ?? "Reference"}
                                </span>
                                {c.sourceLabel ? (
                                  <span className="ml-1.5 text-xs text-slate-500">
                                    ({c.sourceLabel})
                                  </span>
                                ) : null}
                                <p className="mt-0.5 text-slate-700">
                                  {c.excerpt}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Build activity
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Rule syncs and approvals on this draft (audit-friendly trail).
              </p>
              {draft.buildDraftEvents.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No events yet — reload after rule evaluation runs.
                </p>
              ) : (
                <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
                  {draft.buildDraftEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={buildActivityBadgeTone(ev.eventType)}>
                          {buildActivityLabel(ev.eventType)}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {ev.createdAt.toLocaleString()}
                        </span>
                      </div>
                      <pre className="mt-2 max-h-24 overflow-x-auto overflow-y-auto rounded bg-white p-2 text-[10px] leading-snug text-slate-700">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Human review
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Approving marks the draft as ready for billing operations. A
                  full production path would enqueue compliant claim submission
                  and attach evidence for high-risk edits.
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
            <Preview837pForm
              draftId={draft.id}
              orgSlug={orgSlug}
              disabled={draft.lines.length === 0}
            />
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

import { isEdiOutboundHttpConfigured } from "@/lib/connect/edi/outbound-x12-http";
import { tenantPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { isTenantSettingsEditor } from "@/lib/tenant-admin-guard";
import { assertOrgAccess } from "@/lib/tenant-context";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectSubnav } from "../../connect-subnav";
import { Claim837OutboundForm } from "./claim-837-outbound-form";
import { Claim837RecordForm } from "./claim-837-record-form";

export default async function ClaimTimelinePage({
  params,
}: {
  params: Promise<{ orgSlug: string; claimId: string }>;
}) {
  const { orgSlug, claimId } = await params;
  const session = await getSession();
  if (!session) notFound();

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  const claim = await tenantPrisma(orgSlug).claim.findFirst({
    where: { id: claimId, tenantId: ctx.tenant.id },
    include: {
      patient: true,
      encounter: {
        select: { id: true, dateOfService: true },
      },
      claimDraft: {
        select: { id: true, status: true, encounterId: true },
      },
      statements: {
        orderBy: { dueDate: "desc" },
        select: { id: true, number: true, status: true },
        take: 1,
      },
      timeline: { orderBy: { at: "asc" } },
      edi837Submissions: { orderBy: { recordedAt: "desc" } },
      adjudications: {
        orderBy: [{ adjudicationDate: "desc" }, { paidDate: "desc" }],
        include: {
          remittance835: true,
          lines: {
            orderBy: [{ procedureCode: "asc" }, { remittanceLineKey: "asc" }],
            include: {
              casAdjustments: { orderBy: { sequence: "asc" } },
            },
          },
        },
      },
    },
  });
  if (!claim) notFound();

  const canRecord837 = await isTenantSettingsEditor(session, ctx.tenant.id);

  const buildEncounterId =
    claim.encounterId ?? claim.claimDraft?.encounterId ?? null;
  const latestStatement = claim.statements[0] ?? null;

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="claims" />

      {buildEncounterId ? (
        <Card className="border-slate-200 bg-slate-50/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Related in other modules
          </p>
          <p className="mt-1 text-sm text-slate-800">
            {claim.encounter ? (
              <>
                Linked encounter (DOS{" "}
                {claim.encounter.dateOfService.toLocaleDateString()}).
              </>
            ) : (
              <>Linked to the Build encounter for this claim.</>
            )}
            {claim.claimDraft ? (
              <span className="mt-1 block text-xs text-slate-600">
                Source draft{" "}
                <span className="font-mono">{claim.claimDraft.id.slice(0, 8)}</span>
                · {claim.claimDraft.status.replaceAll("_", " ")}
              </span>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/o/${orgSlug}/build/encounters/${buildEncounterId}`}
            >
              <Button type="button" variant="secondary" size="sm">
                View encounter in Build
              </Button>
            </Link>
            {latestStatement ? (
              <Link href={`/o/${orgSlug}/pay/statements/${latestStatement.id}`}>
                <Button type="button" variant="primary" size="sm">
                  Next recommended step: Pay statement
                </Button>
              </Link>
            ) : (
              <Link href={`/o/${orgSlug}/pay`}>
                <Button type="button" variant="secondary" size="sm">
                  Next recommended step: Pay
                </Button>
              </Link>
            )}
            <Link href={`/o/${orgSlug}/support`}>
              <Button type="button" variant="secondary" size="sm">
                Then: Support follow-up
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <PageHeader
        title={`Claim ${claim.claimNumber}`}
        description={
          claim.patient
            ? `${claim.patient.lastName}, ${claim.patient.firstName}`
            : "Patient not linked"
        }
        actions={
          <Link href={`/o/${orgSlug}/connect`}>
            <Button type="button" variant="secondary" size="sm">
              Back to claims
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Payer & remittance
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="info">{claim.status.toLowerCase()}</Badge>
            {claim.payerName ? (
              <Badge tone="default">{claim.payerName}</Badge>
            ) : null}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase text-slate-500">Billed</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {usd(claim.billedCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Paid</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {claim.paidCents != null ? usd(claim.paidCents) : "—"}
              </dd>
            </div>
          </dl>
          {claim.denialReason ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase text-red-800">
                Denial / adjustment reason
              </p>
              <p className="mt-2 text-sm text-red-900">{claim.denialReason}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            EDI references
          </h2>
          <p className="mt-2 text-xs text-slate-600">
            Inbound 277/835/997/999 updates merge trace fields into{" "}
            <span className="font-mono">ediRefs</span> (no raw X12 stored on the
            claim row). Outbound 837 payloads can be stored as{" "}
            <span className="font-mono">edi_outbound</span> batches for audit.
          </p>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li>
              Last inbound:{" "}
              <span className="font-medium text-slate-800">
                {ediSummary(claim.ediRefs).lastTxn ?? "—"}
              </span>
            </li>
            <li>
              837 submit (latest):{" "}
              <span className="font-medium text-slate-800">
                {latest837OneLiner(claim.edi837Submissions) ?? "—"}
              </span>
            </li>
            <li>
              277 last status:{" "}
              {ediSummary(claim.ediRefs).last277 ?? "—"}
            </li>
            <li>
              835 last payment raw:{" "}
              {ediSummary(claim.ediRefs).last835Pay ?? "—"}
            </li>
            <li>
              Last TRN refs:{" "}
              {ediSummary(claim.ediRefs).trnRefs ?? "—"}
            </li>
            <li>
              Last EDI ingest batch:{" "}
              <span className="font-mono text-[11px]">
                {ediSummary(claim.ediRefs).ingestionBatchId ?? "—"}
              </span>
            </li>
          </ul>
          {claim.edi837Submissions.length > 0 ? (
            <ul className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-[10px] text-slate-600">
              {claim.edi837Submissions.slice(0, 5).map((s) => (
                <li key={s.id} className="font-mono leading-snug">
                  <span className="text-slate-400">
                    {s.recordedAt.toLocaleString()}
                  </span>{" "}
                  · {format837SubmissionShort(s)}
                </li>
              ))}
            </ul>
          ) : null}
          {ediJsonBlock(claim.ediRefs) ? (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[10px] leading-relaxed text-slate-800">
              {ediJsonBlock(claim.ediRefs)}
            </pre>
          ) : null}
          {canRecord837 ? (
            <>
              <Claim837OutboundForm
                orgSlug={orgSlug}
                claimId={claim.id}
                httpTransportConfigured={isEdiOutboundHttpConfigured()}
              />
              <Claim837RecordForm orgSlug={orgSlug} claimId={claim.id} />
            </>
          ) : null}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Imported remittance &amp; adjudication
        </h2>
        <p className="mt-2 text-xs text-slate-600">
          Normalized{" "}
          <span className="font-mono">ClaimAdjudication</span> and{" "}
          <span className="font-mono">RemittanceAdjudicationLine</span> rows
          (spreadsheet enrichment or future 835 ingest). Line-level CARC/RARC
          supports denial analytics; this is not raw X12.
        </p>
        {claim.adjudications.length === 0 ? (
          <p className="mt-6 rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            No adjudication slices for this claim yet. Run dataset import with
            remittance/adjudication workbooks or post 835 correlation when
            wired.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {claim.adjudications.map((adj) => (
              <div
                key={adj.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="teal">ERA slice</Badge>
                    {adj.remittance835.eraTraceNumber ? (
                      <span className="font-mono text-[11px] text-slate-600">
                        TRN {adj.remittance835.eraTraceNumber}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-slate-500">
                      remittance ·{" "}
                      <span className="font-mono">
                        {adj.remittance835.remittanceKey}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Adjudication key{" "}
                    <span className="font-mono">{adj.adjudicationKey}</span>
                    {adj.payerClaimControlNumber
                      ? ` · payer claim ref ${adj.payerClaimControlNumber}`
                      : ""}
                  </p>
                </div>
                <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Adjudication date
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
                        {fmtDate(adj.adjudicationDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Paid date
                      </dt>
                      <dd className="mt-0.5 font-medium tabular-nums text-slate-800">
                        {fmtDate(adj.paidDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Phase / status
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {[adj.adjudicationPhase, adj.claimStatusAtAdjudication]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Payer (slice)
                      </dt>
                      <dd className="mt-0.5 text-slate-800">
                        {adj.payerName ?? "—"}
                      </dd>
                    </div>
                  </dl>
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Allowed
                      </dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {usd(adj.allowedCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">Paid</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {usd(adj.paidCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">PR</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {usd(adj.patientResponsibilityCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Deductible
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {usd(adj.deductibleCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Copay / coins
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {usd(adj.copayCents)} / {usd(adj.coinsuranceCents)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-500">
                        Adjustment
                      </dt>
                      <dd className="mt-0.5 tabular-nums">
                        {usd(adj.adjustmentCents)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {adj.denialCategory ? (
                  <div className="mx-4 mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900 sm:mx-5">
                    <span className="font-semibold">Denial category: </span>
                    {adj.denialCategory}
                  </div>
                ) : null}
                {(() => {
                  const ex = claimAdjudicationInbound835MiaMoa(adj.extra);
                  return ex ? (
                    <div className="mx-4 mb-2 text-[11px] text-slate-500 sm:mx-5">
                      Inbound 835 (pre-SVC): {ex.miaCount} MIA segment(s),{" "}
                      {ex.moaCount} MOA segment(s) — full strings in adjudication
                      JSON <span className="font-mono">extra</span>.
                    </div>
                  ) : null;
                })()}
                <div className="border-t border-slate-100 px-2 pb-4 pt-2 sm:px-3">
                  <p className="px-2 py-2 text-xs font-medium uppercase text-slate-500">
                    Service lines ({adj.lines.length})
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Proc</th>
                          <th className="px-2 py-2">Description</th>
                          <th className="px-2 py-2 text-right">Billed</th>
                          <th className="px-2 py-2 text-right">Allowed</th>
                          <th className="px-2 py-2 text-right">Paid</th>
                          <th className="px-2 py-2 text-right">Adj ∑</th>
                          <th className="px-2 py-2">CARC</th>
                          <th className="px-2 py-2">RARCs</th>
                          <th className="px-2 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {adj.lines.flatMap((ln) => {
                          const ex = ln.extra;
                          const rarcList =
                            ex &&
                            typeof ex === "object" &&
                            !Array.isArray(ex) &&
                            "rarcCodes" in ex
                              ? jsonStringArrayFromExtra(
                                  (ex as { rarcCodes?: unknown }).rarcCodes,
                                )
                              : ln.rarcCode
                                ? [ln.rarcCode]
                                : [];
                          const row = (
                            <tr key={ln.id} className="text-slate-700">
                              <td className="px-2 py-2 font-mono">
                                {ln.procedureCode ?? "—"}
                              </td>
                              <td className="max-w-[200px] px-2 py-2 leading-snug">
                                {ln.procedureDescription ?? "—"}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">
                                {usd(ln.lineBilledCents)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">
                                {usd(ln.lineAllowedCents)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums font-medium">
                                {usd(ln.linePaidCents)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-slate-600">
                                {usd(ln.adjustmentCents)}
                              </td>
                              <td className="px-2 py-2 align-top">
                                <span className="font-mono text-[11px]">
                                  {ln.carcCode ?? "—"}
                                </span>
                                {ln.carcDescription ? (
                                  <span className="mt-0.5 block text-[10px] text-slate-500">
                                    {ln.carcDescription}
                                  </span>
                                ) : null}
                              </td>
                              <td className="max-w-[120px] px-2 py-2 align-top font-mono text-[10px]">
                                {rarcList.length ? rarcList.join(", ") : "—"}
                                {ln.rarcDescription ? (
                                  <span className="mt-0.5 block text-[10px] text-slate-500">
                                    {ln.rarcDescription}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-2 py-2 align-top">
                                {ln.lineAdjudicationStatus ?? "—"}
                                {ln.denialCategory ? (
                                  <span className="mt-0.5 block text-[10px] text-red-700">
                                    {ln.denialCategory}
                                  </span>
                                ) : null}
                              </td>
                            </tr>
                          );
                          if (ln.casAdjustments.length === 0) return [row];
                          const casRow = (
                            <tr key={`${ln.id}-cas`} className="bg-slate-50/80">
                              <td colSpan={9} className="px-2 py-2">
                                <p className="mb-1 text-[10px] font-medium uppercase text-slate-500">
                                  CAS ({ln.casAdjustments.length})
                                </p>
                                <table className="w-full min-w-[560px] text-left text-[10px]">
                                  <thead className="text-slate-500">
                                    <tr>
                                      <th className="py-0.5 pr-2">#</th>
                                      <th className="py-0.5 pr-2">Grp</th>
                                      <th className="py-0.5 pr-2">CARC</th>
                                      <th className="py-0.5 pr-2 text-right">
                                        Amt
                                      </th>
                                      <th className="py-0.5">RARC</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ln.casAdjustments.map((a) => (
                                      <tr key={a.id}>
                                        <td className="py-0.5 pr-2">
                                          {a.sequence}
                                        </td>
                                        <td className="py-0.5 pr-2 font-mono">
                                          {a.claimAdjustmentGroupCode}
                                        </td>
                                        <td className="py-0.5 pr-2 font-mono">
                                          {a.carcCode}
                                        </td>
                                        <td className="py-0.5 pr-2 text-right tabular-nums">
                                          {usd(a.adjustmentAmountCents)}
                                        </td>
                                        <td className="py-0.5 font-mono">
                                          {jsonStringArrayFromExtra(
                                            a.rarcCodes,
                                          ).join(", ") || "—"}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                          return [row, casRow];
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
        <ol className="relative mt-6 space-y-6 border-l border-slate-200 pl-6">
          {claim.timeline.map((ev, i) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[25px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-brand-coral" />
              <p className="text-sm font-medium text-slate-900">{ev.label}</p>
              {ev.detail ? (
                <p className="mt-0.5 text-sm text-slate-600">{ev.detail}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                {ev.at.toLocaleString()}{" "}
                {i === claim.timeline.length - 1 ? "· latest" : ""}
              </p>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function jsonStringArrayFromExtra(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function claimAdjudicationInbound835MiaMoa(
  extra: unknown,
): { miaCount: number; moaCount: number } | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const o = extra as Record<string, unknown>;
  const mia = o.miaSegments;
  const moa = o.moaSegments;
  const miaCount = Array.isArray(mia) ? mia.length : 0;
  const moaCount = Array.isArray(moa) ? moa.length : 0;
  if (miaCount === 0 && moaCount === 0) return null;
  return { miaCount, moaCount };
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
}

function ediSummary(ediRefs: unknown): {
  lastTxn: string | null;
  last277: string | null;
  last835Pay: string | null;
  trnRefs: string | null;
  ingestionBatchId: string | null;
} {
  if (!ediRefs || typeof ediRefs !== "object" || Array.isArray(ediRefs)) {
    return {
      lastTxn: null,
      last277: null,
      last835Pay: null,
      trnRefs: null,
      ingestionBatchId: null,
    };
  }
  const o = ediRefs as Record<string, unknown>;
  const lastTxn =
    typeof o.lastTransactionSet === "string" ? o.lastTransactionSet : null;
  const code =
    typeof o.last277StatusCode === "string" ? o.last277StatusCode : null;
  const id =
    typeof o.last277SubmitterClaimId === "string"
      ? o.last277SubmitterClaimId
      : null;
  const last277 =
    code != null ? (id != null ? `CLP02=${code} (${id})` : `CLP02=${code}`) : null;
  const last835Pay =
    typeof o.last835PaymentRaw === "string" ? o.last835PaymentRaw : null;
  const trnRaw = o.lastInboundTrnRefs;
  const trnRefs = Array.isArray(trnRaw)
    ? trnRaw.filter((x): x is string => typeof x === "string").join(", ") || null
    : null;
  const ingestionBatchId =
    typeof o.lastEdiIngestionBatchId === "string"
      ? o.lastEdiIngestionBatchId
      : null;
  return { lastTxn, last277, last835Pay, trnRefs, ingestionBatchId };
}

function ediJsonBlock(ediRefs: unknown): string | null {
  if (!ediRefs || typeof ediRefs !== "object" || Array.isArray(ediRefs)) {
    return null;
  }
  if (Object.keys(ediRefs as object).length === 0) {
    return null;
  }
  return JSON.stringify(ediRefs, null, 2);
}

type SubRow = {
  clearinghouseLabel: string | null;
  interchangeControlNumber: string | null;
  groupControlNumber: string | null;
  transactionSetControlNumber: string | null;
};

function latest837OneLiner(rows: SubRow[]): string | null {
  if (!rows.length) return null;
  return format837SubmissionShort(rows[0]);
}

function format837SubmissionShort(s: SubRow): string {
  const parts = [
    s.clearinghouseLabel,
    s.interchangeControlNumber && `ISA ${s.interchangeControlNumber}`,
    s.groupControlNumber && `GS ${s.groupControlNumber}`,
    s.transactionSetControlNumber && `ST ${s.transactionSetControlNumber}`,
  ].filter(Boolean);
  return parts.join(" · ") || "(no controls)";
}

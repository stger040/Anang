import { tenantPrisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectSubnav } from "../../connect-subnav";

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function jsonStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function inbound835Context(extra: unknown): {
  miaCount: number;
  moaCount: number;
} | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const o = extra as Record<string, unknown>;
  const mia = o.miaSegments;
  const moa = o.moaSegments;
  const miaCount = Array.isArray(mia) ? mia.length : 0;
  const moaCount = Array.isArray(moa) ? moa.length : 0;
  if (miaCount === 0 && moaCount === 0) return null;
  return { miaCount, moaCount };
}

export default async function Remittance835DetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; remittanceId: string }>;
}) {
  const { orgSlug, remittanceId } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const rem = await tenantPrisma(orgSlug).remittance835.findFirst({
    where: { id: remittanceId, tenantId: tenant.id },
    include: {
      adjudications: {
        include: {
          claim: { select: { id: true, claimNumber: true } },
          lines: {
            orderBy: [{ remittanceLineKey: "asc" }],
            include: {
              casAdjustments: { orderBy: { sequence: "asc" } },
            },
          },
        },
        orderBy: [{ adjudicationDate: "desc" }, { id: "asc" }],
      },
    },
  });
  if (!rem) notFound();

  const headerDescription = rem.eraTraceNumber
    ? `${rem.remittanceKey} · TRN ${rem.eraTraceNumber}`
    : rem.remittanceKey;

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="remittances" />

      <PageHeader
        title="Remittance detail"
        description={headerDescription}
        actions={
          <Link href={`/o/${orgSlug}/connect/remittances`}>
            <Button type="button" size="sm" variant="secondary">
              All remittances
            </Button>
          </Link>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 text-sm text-slate-700">
          <Badge tone="default">{rem.source}</Badge>
          <span>
            Imported{" "}
            {rem.importedAt.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <span className="tabular-nums">
            {rem.adjudications.length} adjudication
            {rem.adjudications.length === 1 ? "" : "s"}
          </span>
        </div>
      </Card>

      <div className="space-y-6">
        {rem.adjudications.map((adj) => {
          const clp835 = inbound835Context(adj.extra);
          return (
          <Card key={adj.id} className="overflow-hidden p-0">
            <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">
                    Claim
                  </p>
                  <Link
                    href={`/o/${orgSlug}/connect/claims/${adj.claim.id}`}
                    className="font-mono text-sm font-semibold text-brand-navy underline"
                  >
                    {adj.claim.claimNumber}
                  </Link>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div className="tabular-nums">
                    Paid {usd(adj.paidCents)} · PR{" "}
                    {usd(adj.patientResponsibilityCents)}
                  </div>
                  {adj.denialCategory ? (
                    <div className="mt-1 text-amber-800">{adj.denialCategory}</div>
                  ) : null}
                  {clp835 ? (
                    <div className="mt-2 text-[11px] text-slate-500">
                      CLP-level 835 segments: MIA {clp835.miaCount}, MOA{" "}
                      {clp835.moaCount}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-white text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Line key</th>
                    <th className="px-4 py-2">Proc</th>
                    <th className="px-4 py-2">Billed</th>
                    <th className="px-4 py-2">Allowed</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">PR</th>
                    <th className="px-4 py-2">Adj ∑</th>
                    <th className="px-4 py-2">CARC</th>
                    <th className="px-4 py-2">RARCs</th>
                    <th className="px-4 py-2">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {adj.lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-6 text-center text-slate-500"
                      >
                        No service lines stored for this adjudication.
                      </td>
                    </tr>
                  ) : (
                    adj.lines.flatMap((ln) => {
                      const rarcs = jsonStringArray(
                        (ln.extra &&
                        typeof ln.extra === "object" &&
                        !Array.isArray(ln.extra) &&
                        "rarcCodes" in ln.extra
                          ? (ln.extra as { rarcCodes?: unknown }).rarcCodes
                          : null) ?? (ln.rarcCode ? [ln.rarcCode] : []),
                      );
                      const mainRow = (
                        <tr key={ln.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2 font-mono text-[11px] text-slate-600">
                            {ln.remittanceLineKey}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {ln.procedureCode ?? "—"}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {usd(ln.lineBilledCents)}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {usd(ln.lineAllowedCents)}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {usd(ln.linePaidCents)}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {usd(ln.patientResponsibilityCents)}
                          </td>
                          <td className="px-4 py-2 tabular-nums text-slate-700">
                            {usd(ln.adjustmentCents)}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">
                            {ln.carcCode ?? "—"}
                          </td>
                          <td className="max-w-[140px] px-4 py-2 font-mono text-[10px] text-slate-700">
                            {rarcs.length ? rarcs.join(", ") : "—"}
                          </td>
                          <td className="max-w-[200px] px-4 py-2 text-xs text-slate-600">
                            {ln.procedureDescription ?? "—"}
                          </td>
                        </tr>
                      );
                      if (ln.casAdjustments.length === 0) return [mainRow];
                      const sub = (
                        <tr key={`${ln.id}-cas`} className="bg-slate-50/90">
                          <td colSpan={10} className="px-4 py-2">
                            <p className="mb-2 text-[10px] font-medium uppercase text-slate-500">
                              CAS adjustments ({ln.casAdjustments.length})
                            </p>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[640px] text-left text-xs">
                                <thead className="text-slate-500">
                                  <tr>
                                    <th className="py-1 pr-2">#</th>
                                    <th className="py-1 pr-2">Grp</th>
                                    <th className="py-1 pr-2">CARC</th>
                                    <th className="py-1 pr-2 text-right">
                                      Amt
                                    </th>
                                    <th className="py-1 pr-2">Qty</th>
                                    <th className="py-1">RARC</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ln.casAdjustments.map((a) => (
                                    <tr key={a.id} className="text-slate-700">
                                      <td className="py-1 pr-2 tabular-nums">
                                        {a.sequence}
                                      </td>
                                      <td className="py-1 pr-2 font-mono">
                                        {a.claimAdjustmentGroupCode}
                                      </td>
                                      <td className="py-1 pr-2 font-mono">
                                        {a.carcCode}
                                      </td>
                                      <td className="py-1 pr-2 text-right tabular-nums">
                                        {usd(a.adjustmentAmountCents)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {a.quantity ?? "—"}
                                      </td>
                                      <td className="py-1 font-mono text-[10px]">
                                        {jsonStringArray(a.rarcCodes).join(", ") ||
                                          "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      );
                      return [mainRow, sub];
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        );
        })}
      </div>
    </div>
  );
}

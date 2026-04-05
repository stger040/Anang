import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConnectSubnav } from "../connect-subnav";

export default async function ConnectRemittancesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!tenant) notFound();

  const remittances = await prisma.remittance835.findMany({
    where: { tenantId: tenant.id },
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      remittanceKey: true,
      eraTraceNumber: true,
      source: true,
      importedAt: true,
      _count: { select: { adjudications: true } },
      adjudications: {
        select: {
          _count: { select: { lines: true } },
          claim: { select: { id: true, claimNumber: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="remittances" />

      <PageHeader
        title="Connect — remittance headers"
        description="Imported ERA / spreadsheet remittance buckets (Remittance835). Open a claim timeline to see adjudication slices and service-line CARC/RARC tied to that claim."
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Remittance key</th>
                <th className="px-4 py-3">ERA trace</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Imported</th>
                <th className="px-4 py-3">Adjudications</th>
                <th className="px-4 py-3">Service lines</th>
                <th className="px-4 py-3">Claims</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {remittances.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm text-slate-600"
                  >
                    No remittance headers yet. Run remittance/adjudication
                    enrichment import or wire 835 ingest to populate this list.
                  </td>
                </tr>
              ) : (
                remittances.map((r) => {
                  const lineTotal = r.adjudications.reduce(
                    (s, adj) => s + adj._count.lines,
                    0,
                  );
                  const claimById = new Map<
                    string,
                    { id: string; claimNumber: string }
                  >();
                  for (const adj of r.adjudications) {
                    claimById.set(adj.claim.id, adj.claim);
                  }
                  const claimLinks = [...claimById.values()].slice(0, 14);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-mono text-xs">
                        <Link
                          href={`/o/${orgSlug}/connect/remittances/${r.id}`}
                          className="text-brand-navy underline hover:no-underline"
                        >
                          {r.remittanceKey}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {r.eraTraceNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="default">{r.source}</Badge>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600">
                        {r.importedAt.toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800">
                        {r._count.adjudications}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-800">
                        {lineTotal}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex max-w-[240px] flex-wrap gap-x-2 gap-y-1">
                          {claimLinks.length === 0 ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : (
                            claimLinks.map((c) => (
                              <Link
                                key={c.id}
                                href={`/o/${orgSlug}/connect/claims/${c.id}`}
                                className="font-mono text-[11px] font-medium text-brand-navy underline"
                              >
                                {c.claimNumber}
                              </Link>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Finding detail on a claim
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Each adjudication row belongs to one claim. Use{" "}
          <Link
            href={`/o/${orgSlug}/connect`}
            className="font-medium text-brand-navy underline"
          >
            Claims
          </Link>{" "}
          → <strong>Timeline</strong> to view normalized amounts and line-level
          codes for that claim.
        </p>
        <div className="mt-4">
          <Link href={`/o/${orgSlug}/connect`}>
            <Button type="button" size="sm" variant="secondary">
              Back to claims
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { formatTradingPartnerSummary } from "@/lib/trading-partner-enrollment";
import { CLAIM_STATUSES } from "@anang/types";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

import { ConnectSubnav } from "./connect-subnav";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info" | "teal"> =
  {
    DRAFT: "default",
    READY: "info",
    SUBMITTED: "info",
    ACCEPTED: "success",
    DENIED: "danger",
    PAID: "success",
    APPEALED: "warning",
  };

export default async function ConnectClaimsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true, settings: true },
  });
  if (!tenant) return null;

  const rawSettings =
    tenant.settings && typeof tenant.settings === "object"
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const implementation = parseImplementationSettings(
    rawSettings.implementation,
  );
  const tradingPartnerLine = formatTradingPartnerSummary(
    implementation?.tradingPartnerEnrollment,
  );

  const claims = await prisma.claim.findMany({
    where: { tenantId: tenant.id },
    orderBy: { submittedAt: "desc" },
    include: {
      patient: true,
      _count: { select: { adjudications: true } },
    },
  });

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="claims" />

      <PageHeader
        title="Connect — claims lifecycle"
        description="Claim lifecycle workspace for payer timelines and remittance. EDI submission and remittance posting integrate here once clearinghouse and payer feeds are configured."
        actions={
          <span className="text-xs text-slate-500">
            States: {CLAIM_STATUSES.join(", ")}
          </span>
        }
      />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Trading partner enrollment
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {tradingPartnerLine ?? (
            <>
              No clearinghouse profile yet. Tenant admins can record ISA/GS
              enrollment and environment under{" "}
              <Link
                href={`/o/${orgSlug}/settings/implementation`}
                className="font-medium text-brand-navy underline"
              >
                Settings → Implementation hub
              </Link>
              .
            </>
          )}
        </p>
        {tradingPartnerLine ? (
          <p className="mt-3 text-xs text-slate-500">
            Edit full enrollment fields (sender/receiver IDs, notes) in{" "}
            <Link
              href={`/o/${orgSlug}/settings/implementation`}
              className="text-brand-navy underline"
            >
              Implementation hub
            </Link>
            .
          </p>
        ) : null}
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Claim #</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Imported ERA</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-sm text-slate-600"
                  >
                    No claims in this tenant yet. FHIR imports with Claim
                    resources or spreadsheet enrichment create rows here.
                  </td>
                </tr>
              ) : (
                claims.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs">
                      {c.claimNumber}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {c.patient
                        ? `${c.patient.lastName}, ${c.patient.firstName}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.payerName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[c.status] ?? "default"}>
                        {c.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {usd(c.billedCents)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {c.paidCents != null ? usd(c.paidCents) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {c._count.adjudications > 0 ? (
                        <Badge tone="teal">
                          {c._count.adjudications} adjudication
                          {c._count.adjudications === 1 ? "" : "s"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/o/${orgSlug}/connect/claims/${c.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Timeline
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          EDI & clearinghouse
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Inbound 277 / 835 / 997 / 999</p>
            <p className="mt-1">
              Partner or middleware can POST X12 text to{" "}
              <code className="rounded bg-white px-1 text-xs">
                /api/webhooks/clearinghouse
              </code>{" "}
              with{" "}
              <code className="rounded bg-white px-1 text-xs">
                Authorization: Bearer
              </code>{" "}
              and server env{" "}
              <code className="rounded bg-white px-1 text-xs">
                CLEARINGHOUSE_WEBHOOK_SECRET
              </code>
              . JSON body:{" "}
              <code className="rounded bg-white px-1 text-xs">
                tenantSlug
              </code>
              ,{" "}
              <code className="rounded bg-white px-1 text-xs">x12</code>              . CLP
              rows match on claim number. Each POST also creates an{" "}
              <span className="font-mono">IngestionBatch</span> +{" "}
              <span className="font-mono">SourceArtifact</span> (SHA-256; optional
              inline X12 up to{" "}
              <span className="font-mono">FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES</span>
              , same cap as FHIR imports). Batch{" "}
              <span className="font-mono">metadata</span> stores structural
              validation;{" "}
              <span className="font-mono">EDI_INBOUND_X12_VALIDATE_STRICT=true</span>{" "}
              skips claim updates when checks fail (E2b2b4).
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Outbound 837</p>
            <p className="mt-1">
              Claim timeline can store raw X12 as an{" "}
              <span className="font-mono">edi_outbound</span> artifact and optional
              HTTP POST (env <span className="font-mono">EDI_OUTBOUND_HTTP_*</span>
              ). Functional / implementation acks use the same webhook with ST*
              997/999 and AK2 control correlation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

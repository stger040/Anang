import { CrossModuleChip } from "@/components/cross-module-chip";
import { tenantPrisma } from "@/lib/prisma";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { formatTradingPartnerSummary } from "@/lib/trading-partner-enrollment";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";
import { CLAIM_STATUSES } from "@anang/types";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import { ModuleKey } from "@prisma/client";
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
  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) return null;
  const { ctx, operational, fullSuiteDashboard } = w;
  const eff = ctx.effectiveModules;

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
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

  const claims = await tenantPrisma(orgSlug).claim.findMany({
    where: { tenantId: tenant.id },
    orderBy: { submittedAt: "desc" },
    include: {
      patient: true,
      _count: { select: { adjudications: true } },
    },
  });

  const deniedClaims = claims.filter((c) => c.status === "DENIED");
  const recentForSidebar = claims.slice(0, 5);
  const subtitle =
    operational.length <= 3 && !fullSuiteDashboard
      ? "Payer-facing claim status and remittance context for your role."
      : "Use Connect after Build approval to track payer-facing status, EDI events, and what should flow into patient responsibility.";

  return (
    <div className="space-y-8">
      <ConnectSubnav orgSlug={orgSlug} current="claims" />

      <PageHeader
        title="Connect — claims lifecycle"
        description={subtitle}
        actions={
          <span className="text-xs text-slate-500">
            States: {CLAIM_STATUSES.join(", ")}
          </span>
        }
      />

      {eff.has(ModuleKey.CONNECT) ? (
        <Card className="border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.04]">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Where prior auth fits
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">
            Use <span className="font-medium text-slate-900">Claims</span> for
            submission and adjudication timeline. When a service needs payer
            approval first, open{" "}
            <Link
              href={`/o/${orgSlug}/connect/authorizations`}
              className="font-medium text-brand-navy underline"
            >
              Authorizations
            </Link>{" "}
            to track the case alongside the claim.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            What this module is for
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Connect is your workspace for claim lifecycle: submission, payer
            responses, denials, appeals, and ERA-backed adjudication. Everything
            you need to answer “where is this claim with the payer?” lives here.
          </p>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
            What should I do today?
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
            <li>Open denied or stuck claims first and read the timeline.</li>
            <li>Confirm 835 / remittance linkage when adjudications are present.</li>
            <li>
              When patient responsibility is clear, hand off balances in Pay (if
              your access includes it).
            </li>
          </ul>
        </Card>
        <Card className="border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-slate-900">Top actions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href={`/o/${orgSlug}/connect/remittances`}
                className="font-medium text-brand-navy underline"
              >
                Browse remittances (835)
              </Link>
            </li>
            {deniedClaims[0] ? (
              <li>
                <Link
                  href={`/o/${orgSlug}/connect/claims/${deniedClaims[0].id}`}
                  className="font-medium text-brand-navy underline"
                >
                  Review a denied claim
                </Link>
                <span className="ml-1 text-xs text-slate-500">
                  ({deniedClaims[0].claimNumber})
                </span>
              </li>
            ) : (
              <li className="text-xs text-slate-600">No denied claims in seed data.</li>
            )}
          </ul>
        </Card>
      </div>

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Where this fits in your org
        </h2>
        <p className="mt-1 text-sm text-slate-700">
          {fullSuiteDashboard || operational.length >= 4
            ? "Connect sits between Build (draft readiness) and Pay (patient balances). Support and Cover pick up patient conversations and affordability."
            : "Other steps in the revenue cycle may run in other modules. Chips below only link when you have access; otherwise they describe the handoff."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.BUILD}
            effectiveModules={eff}
          >
            Related: Build
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.PAY}
            effectiveModules={eff}
            emphasis
          >
            Next often: Pay
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.SUPPORT}
            effectiveModules={eff}
          >
            Then: Support
          </CrossModuleChip>
          <CrossModuleChip
            orgSlug={orgSlug}
            targetModule={ModuleKey.COVER}
            effectiveModules={eff}
          >
            Escalations: Cover
          </CrossModuleChip>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Recent claims</h2>
        <p className="mt-1 text-xs text-slate-500">
          Newest first — same rows as the full table below.
        </p>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {recentForSidebar.length === 0 ? (
            <li className="py-2 text-slate-600">No claims yet.</li>
          ) : (
            recentForSidebar.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span className="font-mono text-xs text-slate-800">
                  {c.claimNumber}
                </span>
                <Badge tone={STATUS_TONE[c.status] ?? "default"}>
                  {c.status.toLowerCase()}
                </Badge>
                <Link
                  href={`/o/${orgSlug}/connect/claims/${c.id}`}
                  className="text-xs font-medium text-brand-navy underline"
                >
                  Open timeline
                </Link>
              </li>
            ))
          )}
        </ul>
      </Card>

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
                          Open claim timeline
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

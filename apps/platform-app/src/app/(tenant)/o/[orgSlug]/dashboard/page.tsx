import { PageHeader, StatCard, Card } from "@anang/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { moduleHomePath, operationalEffectiveModules } from "@/lib/adaptive-workspace";
import { tenantPrisma } from "@/lib/prisma";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) return null;

  const { ctx, operational } = w;

  // Single-module tenants go directly to that module
  if (operational.length === 1) {
    redirect(moduleHomePath(orgSlug, operational[0]!));
  }

  const db = tenantPrisma(orgSlug);
  const tenant = await db.tenant.findUnique({ where: { id: ctx.tenant.id } });
  if (!tenant) return null;

  const has = (m: string) => ctx.effectiveModules.has(m as never);

  // ── Claims AI metrics ──────────────────────────────────────────────────────
  const [claimAgg, pendingReviewCount, deniedRecent] = await Promise.all([
    db.claim.groupBy({ by: ["status"], where: { tenantId: tenant.id }, _count: true }),
    db.encounter.count({ where: { tenantId: tenant.id, reviewStatus: { not: "approved" } } }),
    db.claim.count({
      where: {
        tenantId: tenant.id,
        status: "DENIED",
        updatedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  const totalClaims = claimAgg.reduce((s, g) => s + g._count, 0);
  const deniedTotal = claimAgg.find((g) => g.status === "DENIED")?._count ?? 0;
  const denialRate = totalClaims > 0 ? Math.round((deniedTotal / totalClaims) * 100) : null;

  // ── Patient Pay metrics ────────────────────────────────────────────────────
  const [arAgg, openStatements, recentPayments] = await Promise.all([
    db.statement.aggregate({ where: { tenantId: tenant.id }, _sum: { balanceCents: true } }),
    db.statement.count({ where: { tenantId: tenant.id, status: { not: "PAID" } } }),
    db.payment.aggregate({
      where: {
        tenantId: tenant.id,
        status: "succeeded",
        paidAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _sum: { amountCents: true },
    }),
  ]);
  const totalAr = arAgg._sum.balanceCents ?? 0;
  const collected30d = recentPayments._sum.amountCents ?? 0;

  // ── Recent items for quick links ──────────────────────────────────────────
  const [latestEncounter, latestDenial, latestStatement] = await Promise.all([
    has("BUILD")
      ? db.encounter.findFirst({
          where: { tenantId: tenant.id, reviewStatus: { not: "approved" } },
          orderBy: { dateOfService: "desc" },
          select: { id: true, dateOfService: true, patient: { select: { firstName: true, lastName: true } } },
        })
      : null,
    has("CONNECT")
      ? db.claim.findFirst({
          where: { tenantId: tenant.id, status: "DENIED" },
          orderBy: { updatedAt: "desc" },
          select: { id: true, claimNumber: true },
        })
      : null,
    has("PAY")
      ? db.statement.findFirst({
          where: { tenantId: tenant.id, status: { not: "PAID" } },
          orderBy: { dueDate: "asc" },
          select: { id: true, number: true, balanceCents: true, dueDate: true },
        })
      : null,
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Home"
        description={`${tenant.displayName} · Revenue cycle overview`}
      />

      {/* ── KPI row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Denial rate"
          value={denialRate !== null ? `${denialRate}%` : "—"}
          hint={
            denialRate !== null
              ? denialRate <= 20
                ? "✓ At or below target (20%)"
                : "Target: reduce to 20% with Claims AI"
              : "No claims data yet"
          }
        />
        <StatCard
          label="Claims AI queue"
          value={pendingReviewCount.toString()}
          hint="Encounters awaiting review before submission"
        />
        <StatCard
          label="Open patient AR"
          value={totalAr > 0 ? formatUsd(totalAr) : "—"}
          hint={`${openStatements} open statement${openStatements !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Collected (30 days)"
          value={collected30d > 0 ? formatUsd(collected30d) : "—"}
          hint="Patient payments via Anang"
        />
      </div>

      {/* ── Two product panels ── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Claims AI */}
        {has("BUILD") && (
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Claims AI
                </span>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  Denial prevention
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  AI reviews every claim before it reaches the payer — catching coding errors,
                  modifier issues, and payer-specific rule violations before they become denials.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Pending review</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{pendingReviewCount}</p>
                <p className="text-xs text-slate-400">encounters to approve</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Denied (30d)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{deniedRecent}</p>
                <p className="text-xs text-slate-400">claims to appeal</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Link
                href={`/o/${orgSlug}/build`}
                className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2.5 text-sm font-medium text-blue-800 hover:bg-blue-50"
              >
                <span>Open Claims AI queue →</span>
                {pendingReviewCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                    {pendingReviewCount}
                  </span>
                )}
              </Link>
              {latestEncounter && (
                <Link
                  href={`/o/${orgSlug}/build/encounters/${latestEncounter.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>
                    Next up: {latestEncounter.patient.lastName},{" "}
                    {latestEncounter.patient.firstName}
                    {latestEncounter.dateOfService && (
                      <span className="ml-2 text-xs text-slate-400">
                        {new Date(latestEncounter.dateOfService).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </span>
                  <span className="text-slate-400">→</span>
                </Link>
              )}
              {has("CONNECT") && latestDenial && (
                <Link
                  href={`/o/${orgSlug}/connect/claims/${latestDenial.id}`}
                  className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
                >
                  <span>Latest denial: {latestDenial.claimNumber} — appeal needed</span>
                  <span className="text-red-400">→</span>
                </Link>
              )}
              {has("CONNECT") && (
                <Link
                  href={`/o/${orgSlug}/connect`}
                  className="block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  EHR & Claims — submission status →
                </Link>
              )}
            </div>
          </Card>
        )}

        {/* Patient Pay */}
        {has("PAY") && (
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                  Patient Pay
                </span>
                <h2 className="mt-2 text-base font-semibold text-slate-900">
                  Patient collections
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Patients receive a magic link, open the mobile app or web portal, and pay with
                  help from an AI agent that explains their bill in plain English.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Open AR</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {totalAr > 0 ? formatUsd(totalAr) : "—"}
                </p>
                <p className="text-xs text-slate-400">{openStatements} unpaid statements</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Collected (30d)</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {collected30d > 0 ? formatUsd(collected30d) : "—"}
                </p>
                <p className="text-xs text-slate-400">via patient app + web</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <Link
                href={`/o/${orgSlug}/pay`}
                className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50/50 px-4 py-2.5 text-sm font-medium text-green-800 hover:bg-green-50"
              >
                <span>Open Patient Billing →</span>
                {openStatements > 0 && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                    {openStatements} open
                  </span>
                )}
              </Link>
              {latestStatement && (
                <Link
                  href={`/o/${orgSlug}/pay/statements/${latestStatement.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>
                    Next due: statement {latestStatement.number}
                    <span className="ml-2 text-xs font-semibold text-red-600">
                      {formatUsd(latestStatement.balanceCents)}
                    </span>
                  </span>
                  <span className="text-slate-400">→</span>
                </Link>
              )}
              {has("COVER") && (
                <Link
                  href={`/o/${orgSlug}/cover`}
                  className="block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Assistance — Medicaid, charity care screening →
                </Link>
              )}
              {has("SUPPORT") && (
                <Link
                  href={`/o/${orgSlug}/support`}
                  className="block rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Follow-up queue →
                </Link>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Analytics link if enabled */}
      {has("INSIGHT") && (
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Analytics</p>
            <p className="text-xs text-slate-500">
              Denial trends by payer, AR aging, collection rate over time
            </p>
          </div>
          <Link
            href={`/o/${orgSlug}/insight`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View analytics →
          </Link>
        </Card>
      )}
    </div>
  );
}

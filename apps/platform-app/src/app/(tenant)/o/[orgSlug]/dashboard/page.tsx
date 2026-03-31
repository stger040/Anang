import { prisma } from "@/lib/prisma";
import { PageHeader, StatCard, Card, Badge } from "@anang/ui";
import Link from "next/link";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    include: {
      moduleEntitlements: { where: { enabled: true } },
    },
  });
  if (!tenant) return null;

  const claimAgg = await prisma.claim.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _count: true,
  });
  const totalClaims = claimAgg.reduce((s, g) => s + g._count, 0);
  const denied = claimAgg.find((g) => g.status === "DENIED")?._count ?? 0;
  const paid = claimAgg.find((g) => g.status === "PAID")?._count ?? 0;
  const denialRate =
    totalClaims > 0 ? Math.round((denied / totalClaims) * 100) : 0;

  const openBuild = await prisma.encounter.count({
    where: { tenantId: tenant.id, reviewStatus: { not: "approved" } },
  });

  const arAgg = await prisma.statement.aggregate({
    where: { tenantId: tenant.id },
    _sum: { balanceCents: true },
  });

  const mods = tenant.moduleEntitlements.map((e) => e.module);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Cross-module snapshot for this organization. Metrics blend seeded claims and synthetic statements for pilot demos."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active modules"
          value={mods.length.toString()}
          hint="Entitlements on this tenant"
        />
        <StatCard
          label="Denial rate (seeded)"
          value={`${denialRate}%`}
          hint="From synthetic claim mix in Connect"
        />
        <StatCard
          label="Encounters in review"
          value={openBuild.toString()}
          hint="Build queue (mock clinical pipeline)"
        />
        <StatCard
          label="Open patient balance"
          value={formatUsd(arAgg._sum.balanceCents ?? 0)}
          hint="Sum of statement balances"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Enabled modules
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {mods.map((m) => (
              <Badge key={m} tone="teal">
                {m}
              </Badge>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Disabled modules are hidden from navigation — entitlement-driven UX
            for selective deployment per client.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {mods.includes("BUILD") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/build`}>
                  Open Build queue
                </Link>
              </li>
            ) : null}
            {mods.includes("INSIGHT") ? (
              <li>
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/insight`}
                >
                  Insight dashboards
                </Link>
              </li>
            ) : null}
            {mods.includes("CONNECT") ? (
              <li>
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/connect`}
                >
                  Claims lifecycle
                </Link>
              </li>
            ) : null}
            <li>
              <Link
                className="text-brand-navy underline"
                href={`/o/${orgSlug}/settings`}
              >
                Tenant admin
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

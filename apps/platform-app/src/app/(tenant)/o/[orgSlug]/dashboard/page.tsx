import { ModuleKey } from "@prisma/client";
import { PageHeader, StatCard, Card, Badge } from "@anang/ui";
import Link from "next/link";
import { unlockAllModulesForTesting } from "@/lib/auth-config";
import { tenantPrisma } from "@/lib/prisma";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { slug: orgSlug },
    include: {
      moduleEntitlements: { where: { enabled: true } },
    },
  });
  if (!tenant) return null;

  const claimAgg = await tenantPrisma(orgSlug).claim.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _count: true,
  });
  const totalClaims = claimAgg.reduce((s, g) => s + g._count, 0);
  const denied = claimAgg.find((g) => g.status === "DENIED")?._count ?? 0;
  const paid = claimAgg.find((g) => g.status === "PAID")?._count ?? 0;
  const denialRate =
    totalClaims > 0 ? Math.round((denied / totalClaims) * 100) : 0;

  const openBuild = await tenantPrisma(orgSlug).encounter.count({
    where: { tenantId: tenant.id, reviewStatus: { not: "approved" } },
  });

  const latestEncounter = await tenantPrisma(orgSlug).encounter.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { dateOfService: "desc" },
    select: { id: true, patient: { select: { firstName: true, lastName: true } } },
  });
  const latestClaim = await tenantPrisma(orgSlug).claim.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
    select: { id: true, claimNumber: true, status: true },
  });
  const latestStatement = await tenantPrisma(orgSlug).statement.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { dueDate: "desc" },
    select: { id: true, number: true, status: true },
  });

  const arAgg = await tenantPrisma(orgSlug).statement.aggregate({
    where: { tenantId: tenant.id },
    _sum: { balanceCents: true },
  });

  const mods = unlockAllModulesForTesting()
    ? (Object.values(ModuleKey) as ModuleKey[])
    : tenant.moduleEntitlements.map((e) => e.module);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Start here — staff workflow"
        description="Use this page as the demo entry point: Build claim readiness, Connect claim status, Pay patient responsibility, then follow up in Support/Cover and summarize in Insight."
      />

      <Card className="border-sky-100 bg-sky-50/40 p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          One-patient demo journey
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          Typical flow for a first-time viewer:
          <span className="font-medium">
            {" "}
            Build → Connect → Pay → Support / Cover → Insight
          </span>
          . Each module has quick links and “next step” guidance so you can keep
          a coherent narrative while you click.
        </p>
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
          <JourneyStep
            href={`/o/${orgSlug}/build`}
            label="1. Build"
            detail="Review encounter and draft."
            enabled={mods.includes("BUILD")}
          />
          <JourneyStep
            href={`/o/${orgSlug}/connect`}
            label="2. Connect"
            detail="Track claim status and payer events."
            enabled={mods.includes("CONNECT")}
          />
          <JourneyStep
            href={`/o/${orgSlug}/pay`}
            label="3. Pay"
            detail="Show statement and patient balance."
            enabled={mods.includes("PAY")}
          />
          <JourneyStep
            href={`/o/${orgSlug}/support`}
            label="4. Support / Cover"
            detail="Resolve patient questions and affordability."
            enabled={mods.includes("SUPPORT") || mods.includes("COVER")}
          />
          <JourneyStep
            href={`/o/${orgSlug}/insight`}
            label="5. Insight"
            detail="Summarize operational impact."
            enabled={mods.includes("INSIGHT")}
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active modules"
          value={mods.length.toString()}
          hint="Entitlements on this tenant"
        />
        <StatCard
          label="Denial rate"
          value={`${denialRate}%`}
          hint="From claim rows in Connect"
        />
        <StatCard
          label="Encounters in review"
          value={openBuild.toString()}
          hint="Build queue"
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
          <h2 className="text-sm font-semibold text-slate-900">
            First click suggestions
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {mods.includes("BUILD") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/build`}>
                  Open Build queue
                </Link>
                <p className="text-xs text-slate-500">
                  Best starting point for the prospect demo.
                </p>
              </li>
            ) : null}
            {latestEncounter && mods.includes("BUILD") ? (
              <li>
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/build/encounters/${latestEncounter.id}`}
                >
                  Latest encounter: {latestEncounter.patient.lastName},{" "}
                  {latestEncounter.patient.firstName}
                </Link>
              </li>
            ) : null}
            {latestClaim && mods.includes("CONNECT") ? (
              <li>
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/connect/claims/${latestClaim.id}`}
                >
                  Latest claim: {latestClaim.claimNumber}
                </Link>
                <p className="text-xs text-slate-500">
                  Status: {latestClaim.status.toLowerCase()}
                </p>
              </li>
            ) : null}
            {latestStatement && mods.includes("PAY") ? (
              <li>
                <Link
                  className="text-brand-navy underline"
                  href={`/o/${orgSlug}/pay/statements/${latestStatement.id}`}
                >
                  Latest statement: {latestStatement.number}
                </Link>
                <p className="text-xs text-slate-500">
                  Status: {latestStatement.status.replaceAll("_", " ")}
                </p>
              </li>
            ) : null}
            <li>
              <Link className="text-brand-navy underline" href={`/o/${orgSlug}/settings`}>
                Tenant admin
              </Link>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function JourneyStep({
  href,
  label,
  detail,
  enabled,
}: {
  href: string;
  label: string;
  detail: string;
  enabled: boolean;
}) {
  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-3">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-1 text-xs text-slate-400">Module not enabled</p>
      </div>
    );
  }
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

import { ModuleKey } from "@prisma/client";
import { PageHeader, StatCard, Card, Badge } from "@anang/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  moduleHomePath,
  MODULE_PLAIN_NAME,
  useCompactWorkspace,
  useFullSuiteDashboard,
} from "@/lib/adaptive-workspace";
import { unlockAllModulesForTesting } from "@/lib/auth-config";
import { tenantPrisma } from "@/lib/prisma";
import { canAccessTenantAdminRoutes } from "@/lib/tenant-admin-guard";
import { loadTenantWorkspacePageContext } from "@/lib/workspace-page-context";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const w = await loadTenantWorkspacePageContext(orgSlug);
  if (!w) return null;

  const { ctx, operational, fullSuiteDashboard, session } = w;
  if (operational.length === 1) {
    redirect(moduleHomePath(orgSlug, operational[0]!));
  }

  const compact = useCompactWorkspace(operational) && !fullSuiteDashboard;

  const tenantMods = unlockAllModulesForTesting()
    ? (Object.values(ModuleKey) as ModuleKey[])
    : Array.from(ctx.enabledModules);

  const tenantHas = (m: ModuleKey) => tenantMods.includes(m);
  const userHas = (m: ModuleKey) => ctx.effectiveModules.has(m);

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { id: ctx.tenant.id },
  });
  if (!tenant) return null;

  const claimAgg = await tenantPrisma(orgSlug).claim.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _count: true,
  });
  const totalClaims = claimAgg.reduce((s, g) => s + g._count, 0);
  const denied = claimAgg.find((g) => g.status === "DENIED")?._count ?? 0;
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

  const showTenantAdmin = canAccessTenantAdminRoutes(
    session,
    ctx.membershipRole,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          fullSuiteDashboard
            ? "Start here — staff workflow"
            : compact
              ? "Your workspace"
              : "Home — your modules"
        }
        description={
          fullSuiteDashboard
            ? "Use this page as the demo entry point: Build claim readiness, Connect claim status, Pay patient responsibility, then follow up in Support/Cover and summarize in Insight."
            : compact
              ? `You have ${operational.length} modules for this organization. This page highlights only your workflow — there is no implied “missing” product surface elsewhere.`
              : `You have access to ${operational.length} operational modules. Use the shortcuts below; each module landing page is written to stand on its own.`
        }
      />

      {fullSuiteDashboard ? (
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
              enabled={tenantHas("BUILD")}
            />
            <JourneyStep
              href={`/o/${orgSlug}/connect`}
              label="2. Connect"
              detail="Track claim status and payer events."
              enabled={tenantHas("CONNECT")}
            />
            <JourneyStep
              href={`/o/${orgSlug}/pay`}
              label="3. Pay"
              detail="Show statement and patient balance."
              enabled={tenantHas("PAY")}
            />
            <JourneyStep
              href={
                tenantHas("SUPPORT")
                  ? `/o/${orgSlug}/support`
                  : `/o/${orgSlug}/cover`
              }
              label="4. Support / Cover"
              detail="Resolve patient questions and affordability."
              enabled={tenantHas("SUPPORT") || tenantHas("COVER")}
            />
            <JourneyStep
              href={`/o/${orgSlug}/insight`}
              label="5. Insight"
              detail="Summarize operational impact."
              enabled={tenantHas("INSIGHT")}
            />
          </div>
        </Card>
      ) : (
        <Card className="border-teal-100 bg-teal-50/30 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {compact ? "Your workflow (this role)" : "Your modules"}
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            {compact
              ? "Work moves across the cards below in the order that matches your access — no disabled placeholders, no “locked” steps."
              : "Open any module below. Cross-module work your organization does elsewhere is described on each landing page as context, not as broken navigation."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {operational.map((m, i) => (
              <Link
                key={m}
                href={moduleHomePath(orgSlug, m)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-brand-navy shadow-sm hover:bg-slate-50"
              >
                <span className="text-xs font-semibold text-slate-500">
                  {i + 1}.{" "}
                </span>
                {MODULE_PLAIN_NAME[m]}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Your modules"
          value={operational.length.toString()}
          hint="What you can open in this org"
        />
        {userHas("CONNECT") ? (
          <StatCard
            label="Denial rate"
            value={`${denialRate}%`}
            hint="From claim rows in Connect"
          />
        ) : (
          <StatCard
            label="Denial rate"
            value="—"
            hint="Open Connect to see payer outcomes"
          />
        )}
        {userHas("BUILD") ? (
          <StatCard
            label="Encounters in review"
            value={openBuild.toString()}
            hint="Build queue"
          />
        ) : (
          <StatCard
            label="Encounters in review"
            value="—"
            hint="Handled in Build for your org"
          />
        )}
        {userHas("PAY") ? (
          <StatCard
            label="Open patient balance"
            value={formatUsd(arAgg._sum.balanceCents ?? 0)}
            hint="Sum of statement balances"
          />
        ) : (
          <StatCard
            label="Open patient balance"
            value="—"
            hint="Patient balances live in Pay"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            {fullSuiteDashboard
              ? "Enabled modules (tenant)"
              : "Modules you can use"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(fullSuiteDashboard ? tenantMods : operational).map((m) => (
              <Badge key={m} tone="teal">
                {m}
              </Badge>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            {fullSuiteDashboard
              ? "Disabled modules are hidden from navigation — entitlement-driven UX for selective deployment per client."
              : "Navigation and this page only emphasize modules in your access set. Other product areas may run elsewhere in your organization."}
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            What to open first
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-slate-700">
            {userHas("BUILD") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/build`}>
                  Open Build queue
                </Link>
                <p className="text-xs text-slate-500">
                  Review encounters and drafts before payer submission.
                </p>
              </li>
            ) : null}
            {latestEncounter && userHas("BUILD") ? (
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
            {userHas("CONNECT") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/connect`}>
                  Open Connect
                </Link>
                <p className="text-xs text-slate-500">
                  Claim lifecycle, remits, and payer-facing status.
                </p>
              </li>
            ) : null}
            {latestClaim && userHas("CONNECT") ? (
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
            {userHas("PAY") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/pay`}>
                  Open Pay
                </Link>
                <p className="text-xs text-slate-500">
                  Statements, balances, and patient-facing flows.
                </p>
              </li>
            ) : null}
            {latestStatement && userHas("PAY") ? (
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
            {userHas("INSIGHT") ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/insight`}>
                  Open Insight
                </Link>
                <p className="text-xs text-slate-500">
                  KPI recap when you need the rollup view.
                </p>
              </li>
            ) : null}
            {showTenantAdmin ? (
              <li>
                <Link className="text-brand-navy underline" href={`/o/${orgSlug}/settings`}>
                  Tenant admin
                </Link>
                <p className="text-xs text-slate-500">
                  Users, audit, and implementation settings.
                </p>
              </li>
            ) : null}
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

/**
 * Shows where clinical/financial data lives per tenant slug.
 * Run against the same DATABASE_URL as Vercel to verify Neon ↔ app alignment.
 *
 *   npx tsx prisma/report-tenant-stats.ts
 *   # or with Neon:
 *   node --env-file=.env.neon ../../node_modules/tsx/dist/cli.mjs prisma/report-tenant-stats.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, name: true, displayName: true },
  });

  if (tenants.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No Tenant rows in this database. Run migrations + seed or create a tenant in /admin.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Database:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":***@") ?? "(no DATABASE_URL)");
  // eslint-disable-next-line no-console
  console.log("---");

  for (const t of tenants) {
    const [
      patients,
      encounters,
      claims,
      statements,
      drafts,
      memberships,
    ] = await Promise.all([
      prisma.patient.count({ where: { tenantId: t.id } }),
      prisma.encounter.count({ where: { tenantId: t.id } }),
      prisma.claim.count({ where: { tenantId: t.id } }),
      prisma.statement.count({ where: { tenantId: t.id } }),
      prisma.claimDraft.count({ where: { tenantId: t.id } }),
      prisma.membership.count({ where: { tenantId: t.id } }),
    ]);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          slug: t.slug,
          name: t.displayName,
          patients,
          encounters,
          claims,
          statements,
          claimDrafts: drafts,
          memberships,
        },
        null,
        2,
      ),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

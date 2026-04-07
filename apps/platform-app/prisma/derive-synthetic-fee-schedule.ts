/**
 * Builds deterministic FeeScheduleRate rows from IMPORTED ClaimDraftLine data.
 * Run after synthetic import — not at AI request time. See docs/BUILD_AI_TESTING.md.
 */
import { PrismaClient, ClaimDraftLineSource } from "@prisma/client";

import { SYNTHETIC_BUILD_FEE_SCHEDULE_NAME } from "../src/lib/build/fee-schedule-lookup";
import { normalizeCpt } from "../src/lib/build/retrieval";

const prisma = new PrismaClient();

function cptKeyFromLine(cpt: string): string | null {
  const raw = normalizeCpt(cpt).replace(/[^A-Z0-9]/g, "");
  if (!raw.length) return null;
  return raw.slice(0, 5);
}

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  let rateCount = 0;

  for (const t of tenants) {
    const schedule = await prisma.feeSchedule.upsert({
      where: {
        tenantId_name: { tenantId: t.id, name: SYNTHETIC_BUILD_FEE_SCHEDULE_NAME },
      },
      create: {
        tenantId: t.id,
        name: SYNTHETIC_BUILD_FEE_SCHEDULE_NAME,
        purpose: "synthetic_testing",
        isSynthetic: true,
      },
      update: {
        isSynthetic: true,
        purpose: "synthetic_testing",
      },
    });

    const lines = await prisma.claimDraftLine.findMany({
      where: {
        lineSource: ClaimDraftLineSource.IMPORTED,
        draft: { tenantId: t.id },
      },
      include: {
        draft: {
          include: { encounter: true },
        },
      },
    });

    /** `${placeOfServiceKey}\x00${cptNormalized}` → max chargeCents */
    const agg = new Map<string, number>();

    for (const ln of lines) {
      const cpt = cptKeyFromLine(ln.cpt);
      if (!cpt) continue;
      const pos = (ln.draft.encounter.placeOfService ?? "").trim();

      const bump = (posKey: string, cptNorm: string) => {
        const key = `${posKey}\0${cptNorm}`;
        const prev = agg.get(key) ?? 0;
        if (ln.chargeCents > prev) agg.set(key, ln.chargeCents);
      };

      if (pos) bump(pos, cpt);
      bump("", cpt);
    }

    await prisma.feeScheduleRate.deleteMany({
      where: { feeScheduleId: schedule.id },
    });

    const rows = [...agg.entries()].map(([compound, chargeCents]) => {
      const nul = compound.indexOf("\0");
      const placeOfServiceKey = compound.slice(0, nul);
      const cptNormalized = compound.slice(nul + 1);
      return {
        feeScheduleId: schedule.id,
        cptNormalized,
        placeOfServiceKey,
        chargeCents,
        derivedFromImport: true,
      };
    });

    if (rows.length > 0) {
      await prisma.feeScheduleRate.createMany({ data: rows });
    }
    rateCount += rows.length;
    console.log(
      `Tenant ${t.slug ?? t.id}: fee schedule "${SYNTHETIC_BUILD_FEE_SCHEDULE_NAME}" → ${rows.length} rate(s)`,
    );
  }

  console.log(`Done. Total rate rows written: ${rateCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import type { PrismaClient } from "@prisma/client";

import { normalizeCpt } from "@/lib/build/retrieval";

/** Schedule name created by `prisma/derive-synthetic-fee-schedule.ts`. */
export const SYNTHETIC_BUILD_FEE_SCHEDULE_NAME = "SYNTHETIC_BUILD_TESTING_V1";

type Db = Pick<
  PrismaClient,
  "feeSchedule" | "feeScheduleRate"
>;

/**
 * Resolve billed charge for Build AI testing from deterministic rates only.
 * Order: exact CPT + POS → CPT + wildcard POS ("").
 */
export async function resolveSyntheticChargeCents(
  db: Db,
  args: {
    tenantId: string;
    cpt: string;
    placeOfService?: string | null;
  },
): Promise<{
  chargeCents: number;
  rateId: string | null;
}> {
  const schedule = await db.feeSchedule.findUnique({
    where: {
      tenantId_name: {
        tenantId: args.tenantId,
        name: SYNTHETIC_BUILD_FEE_SCHEDULE_NAME,
      },
    },
    select: { id: true },
  });
  if (!schedule) {
    return { chargeCents: 0, rateId: null };
  }

  const cptNorm = normalizeCpt(args.cpt);
  if (!cptNorm) return { chargeCents: 0, rateId: null };

  const posKey = (args.placeOfService ?? "").trim();

  if (posKey) {
    const exact = await db.feeScheduleRate.findUnique({
      where: {
        feeScheduleId_cptNormalized_placeOfServiceKey: {
          feeScheduleId: schedule.id,
          cptNormalized: cptNorm,
          placeOfServiceKey: posKey,
        },
      },
    });
    if (exact) {
      return { chargeCents: exact.chargeCents, rateId: exact.id };
    }
  }

  const wildcard = await db.feeScheduleRate.findUnique({
    where: {
      feeScheduleId_cptNormalized_placeOfServiceKey: {
        feeScheduleId: schedule.id,
        cptNormalized: cptNorm,
        placeOfServiceKey: "",
      },
    },
  });
  if (wildcard) {
    return { chargeCents: wildcard.chargeCents, rateId: wildcard.id };
  }

  return { chargeCents: 0, rateId: null };
}

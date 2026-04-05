import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Apply a posted {@link Payment} amount to this statement's plan installments in sequence
 * (FIFO). Updates {@link PaymentPlanInstallment.satisfiedCents}, sets `paid` + `paymentId`
 * when an installment is fully covered.
 */
export async function allocatePaymentToPlanInstallments(
  tx: Db,
  args: {
    tenantId: string;
    statementId: string;
    paymentId: string;
    amountCents: number;
  },
): Promise<void> {
  if (args.amountCents <= 0) return;

  const plan = await tx.statementPaymentPlan.findFirst({
    where: { tenantId: args.tenantId, statementId: args.statementId },
    include: {
      installments: { orderBy: { sequence: "asc" } },
    },
  });
  if (!plan || plan.installments.length === 0) return;

  let pool = args.amountCents;
  for (const inst of plan.installments) {
    if (pool <= 0) break;
    if (inst.status === "paid" || inst.status === "skipped") continue;

    const need = Math.max(0, inst.amountCents - inst.satisfiedCents);
    if (need <= 0) continue;

    const apply = Math.min(pool, need);
    const nextSat = inst.satisfiedCents + apply;
    const fully = nextSat >= inst.amountCents;
    pool -= apply;

    await tx.paymentPlanInstallment.update({
      where: { id: inst.id },
      data: {
        satisfiedCents: nextSat,
        status: fully ? "paid" : inst.status,
        paymentId: fully ? args.paymentId : inst.paymentId,
      },
    });
  }
}

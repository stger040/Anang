import { Prisma, type PrismaClient } from "@prisma/client";

import { allocatePaymentToPlanInstallments } from "@/lib/pay/plan-installment-allocation";

const MAX_SERIALIZABLE_RETRIES = 3;

type Db = PrismaClient;

export type StripeCheckoutPaymentPostResult =
  | { status: "duplicate" }
  | { status: "statement_not_found" }
  | { status: "ignored_zero_amount" }
  | {
      status: "posted";
      paymentId: string;
      amountCents: number;
      appliedCents: number;
      unappliedCents: number;
      startingBalanceCents: number;
      endingBalanceCents: number;
    };

function isSerializableConflict(e: unknown): boolean {
  return (
    e != null &&
    typeof e === "object" &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2034"
  );
}

export async function postStripeCheckoutCompletedPayment(
  db: Db,
  args: {
    tenantId: string;
    statementId: string;
    stripeCheckoutSessionId: string;
    stripeEventId: string;
    amountCents: number;
    requestId?: string;
  },
): Promise<StripeCheckoutPaymentPostResult> {
  if (args.amountCents <= 0) {
    return { status: "ignored_zero_amount" };
  }

  for (let attempt = 1; attempt <= MAX_SERIALIZABLE_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const dup = await tx.payment.findFirst({
            where: { stripeCheckoutSessionId: args.stripeCheckoutSessionId },
          });
          if (dup) return { status: "duplicate" as const };

          const stmt = await tx.statement.findFirst({
            where: { id: args.statementId, tenantId: args.tenantId },
          });
          if (!stmt) return { status: "statement_not_found" as const };

          const startingBalanceCents = Math.max(0, stmt.balanceCents);
          const appliedCents = Math.min(args.amountCents, startingBalanceCents);
          const unappliedCents = args.amountCents - appliedCents;
          const endingBalanceCents = startingBalanceCents - appliedCents;

          const payment = await tx.payment.create({
            data: {
              tenantId: args.tenantId,
              statementId: args.statementId,
              amountCents: args.amountCents,
              status: "posted",
              method: "stripe",
              paidAt: new Date(),
              stripeCheckoutSessionId: args.stripeCheckoutSessionId,
            },
          });

          if (
            appliedCents > 0 ||
            stmt.balanceCents !== endingBalanceCents ||
            (endingBalanceCents === 0 && stmt.status !== "paid")
          ) {
            await tx.statement.update({
              where: { id: args.statementId },
              data: {
                balanceCents: endingBalanceCents,
                status: endingBalanceCents === 0 ? "paid" : stmt.status,
              },
            });
          }

          if (appliedCents > 0) {
            await allocatePaymentToPlanInstallments(tx, {
              tenantId: args.tenantId,
              statementId: args.statementId,
              paymentId: payment.id,
              amountCents: appliedCents,
            });
          }

          await tx.auditEvent.create({
            data: {
              tenantId: args.tenantId,
              actorUserId: null,
              action: "pay.stripe.payment_posted",
              resource: "payment",
              metadata: {
                paymentId: payment.id,
                statementId: args.statementId,
                amountCents: args.amountCents,
                appliedCents,
                unappliedCents,
                startingBalanceCents,
                endingBalanceCents,
                stripeCheckoutSessionId: args.stripeCheckoutSessionId,
                stripeEventId: args.stripeEventId,
                ...(args.requestId ? { requestId: args.requestId } : {}),
              },
            },
          });

          return {
            status: "posted" as const,
            paymentId: payment.id,
            amountCents: args.amountCents,
            appliedCents,
            unappliedCents,
            startingBalanceCents,
            endingBalanceCents,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if (attempt < MAX_SERIALIZABLE_RETRIES && isSerializableConflict(e)) {
        continue;
      }
      throw e;
    }
  }

  throw new Error("unreachable");
}

"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

function addWeeks(d: Date, w: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + w * 7);
  return x;
}

function splitBalanceCents(balance: number, n: number): number[] {
  const count = Math.min(12, Math.max(2, Math.floor(n)));
  const base = Math.floor(balance / count);
  let rem = balance - base * count;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem--;
    out.push(base + extra);
  }
  return out;
}

export async function createStatementPaymentPlanAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const statementId = String(formData.get("statementId") ?? "").trim();
  const installmentCount = Number(formData.get("installmentCount") ?? 3);
  const intervalWeeks = Number(formData.get("intervalWeeks") ?? 4);
  const firstDueDateStr = String(formData.get("firstDueDate") ?? "").trim();
  const label =
    String(formData.get("label") ?? "").trim() || "Payment plan";

  if (!orgSlug || !statementId || !firstDueDateStr) {
    return { ok: false, error: "Missing required fields" };
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return { ok: false, error: "Forbidden" };
  }

  const firstDue = new Date(firstDueDateStr);
  if (Number.isNaN(firstDue.getTime())) {
    return { ok: false, error: "Invalid date" };
  }

  const stmt = await prisma.statement.findFirst({
    where: { id: statementId, tenantId: ctx.tenant.id },
  });
  if (!stmt || stmt.balanceCents <= 0) {
    return {
      ok: false,
      error: "Statement not found or has no balance for a plan.",
    };
  }

  const amounts = splitBalanceCents(stmt.balanceCents, installmentCount);
  const avgCents = Math.round(stmt.balanceCents / amounts.length);

  const weeks = Math.min(52, Math.max(1, Math.floor(intervalWeeks)));
  const tenantId = ctx.tenant.id;

  await prisma.$transaction(async (tx) => {
    await tx.statementPaymentPlan.deleteMany({
      where: { tenantId, statementId },
    });

    const plan = await tx.statementPaymentPlan.create({
      data: {
        tenantId,
        statementId,
        label,
        status: "offered",
        installmentCount: amounts.length,
        intervalWeeks: weeks,
        perInstallmentCents: avgCents,
        firstDueDate: firstDue,
      },
    });

    let due = new Date(firstDue);
    for (let i = 0; i < amounts.length; i++) {
      await tx.paymentPlanInstallment.create({
        data: {
          planId: plan.id,
          sequence: i + 1,
          dueDate: new Date(due),
          amountCents: amounts[i]!,
          status: "scheduled",
        },
      });
      due = addWeeks(due, weeks);
    }
  });

  revalidatePath(`/o/${orgSlug}/pay/statements/${statementId}`);
  return { ok: true };
}

/** Staff: record cash/check (or other non-Stripe) payment against one plan installment. */
export async function markPaymentPlanInstallmentPaidAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const installmentId = String(formData.get("installmentId") ?? "").trim();

  if (!orgSlug || !installmentId) {
    return { ok: false, error: "Missing required fields" };
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return { ok: false, error: "Forbidden" };
  }

  const tenantId = ctx.tenant.id;

  const inst = await prisma.paymentPlanInstallment.findFirst({
    where: { id: installmentId, plan: { tenantId } },
    include: { plan: { include: { statement: true } } },
  });
  if (!inst) {
    return { ok: false, error: "Installment not found" };
  }

  const stmt = inst.plan.statement;
  if (!stmt || stmt.tenantId !== tenantId) {
    return { ok: false, error: "Statement not found" };
  }

  const remaining = Math.max(0, inst.amountCents - inst.satisfiedCents);
  if (remaining <= 0) {
    return { ok: false, error: "Installment already satisfied" };
  }

  if (stmt.balanceCents < remaining) {
    return {
      ok: false,
      error: "Statement balance is less than this installment remainder.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        tenantId,
        statementId: stmt.id,
        amountCents: remaining,
        status: "posted",
        method: "staff_mark_paid",
        paidAt: new Date(),
      },
    });

    const newBalance = Math.max(0, stmt.balanceCents - remaining);

    await tx.paymentPlanInstallment.update({
      where: { id: inst.id },
      data: {
        satisfiedCents: inst.amountCents,
        status: "paid",
        paymentId: payment.id,
      },
    });

    await tx.statement.update({
      where: { id: stmt.id },
      data: {
        balanceCents: newBalance,
        status: newBalance === 0 ? "paid" : stmt.status,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId,
        actorUserId: session.userId,
        action: "pay.plan_installment.staff_mark_paid",
        resource: "payment_plan_installment",
        metadata: {
          installmentId: inst.id,
          paymentId: payment.id,
          statementId: stmt.id,
          amountCents: remaining,
        },
      },
    });
  });

  revalidatePath(`/o/${orgSlug}/pay/statements/${stmt.id}`);
  return { ok: true };
}

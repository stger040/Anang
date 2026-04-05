"use server";

import { verifyPatientPayTokenDetailed } from "@/lib/patient-pay-token";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function acknowledgeStatementPaymentPlanAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();
  const planId = String(formData.get("planId") ?? "").trim();

  if (!orgSlug || !token || !planId) {
    return { ok: false, error: "Missing fields" };
  }

  const verified = verifyPatientPayTokenDetailed(token, orgSlug);
  if (!verified.ok) {
    return { ok: false, error: "Invalid or expired link" };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Not found" };

  const plan = await prisma.statementPaymentPlan.findFirst({
    where: {
      id: planId,
      tenantId: tenant.id,
      statementId: verified.payload.statementId,
      status: "offered",
    },
  });
  if (!plan) {
    return { ok: false, error: "No plan is available to acknowledge." };
  }

  await prisma.statementPaymentPlan.update({
    where: { id: plan.id },
    data: {
      status: "acknowledged",
      patientAcknowledgedAt: new Date(),
    },
  });

  revalidatePath(`/p/${orgSlug}/pay/${encodeURIComponent(token)}`);
  return { ok: true };
}

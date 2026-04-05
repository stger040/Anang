"use server";

import { tenantPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function setPatientBillingSmsConsentAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const patientId = String(formData.get("patientId") ?? "").trim();
  const statementId = String(formData.get("statementId") ?? "").trim();
  const consent = String(formData.get("consent") ?? "").trim(); // in | out

  if (!orgSlug || !patientId || !statementId || !consent) {
    return { ok: false, error: "Missing fields" };
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.PAY)) {
    return { ok: false, error: "Forbidden" };
  }

  const stmt = await tenantPrisma(orgSlug).statement.findFirst({
    where: {
      id: statementId,
      tenantId: ctx.tenant.id,
      patientId,
    },
  });
  if (!stmt) {
    return { ok: false, error: "Statement / patient mismatch" };
  }

  const now = new Date();
  if (consent === "in") {
    await tenantPrisma(orgSlug).patient.update({
      where: { id: patientId, tenantId: ctx.tenant.id },
      data: { billingSmsOptInAt: now, billingSmsOptOutAt: null },
    });
  } else if (consent === "out") {
    await tenantPrisma(orgSlug).patient.update({
      where: { id: patientId, tenantId: ctx.tenant.id },
      data: { billingSmsOptOutAt: now },
    });
  } else {
    return { ok: false, error: "Invalid consent" };
  }

  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "pay.patient_billing_sms_consent",
      resource: "patient",
      metadata: { patientId, consent, statementId },
    },
  });

  revalidatePath(`/o/${orgSlug}/pay/statements/${statementId}`);
  return { ok: true };
}

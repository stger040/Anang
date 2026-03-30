"use server";

import { prisma } from "@/lib/prisma";
import { getDemoSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function approveClaimDraft(formData: FormData) {
  const session = await getDemoSession();
  if (!session) throw new Error("Unauthorized");

  const draftId = String(formData.get("draftId") ?? "");
  const orgSlug = String(formData.get("orgSlug") ?? "");
  if (!draftId || !orgSlug) throw new Error("Invalid payload");

  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) throw new Error("Tenant not found");

  const draft = await prisma.claimDraft.findFirst({
    where: { id: draftId, tenantId: tenant.id },
    include: { encounter: true },
  });
  if (!draft) throw new Error("Draft not found");

  await prisma.$transaction([
    prisma.claimDraft.update({
      where: { id: draftId },
      data: {
        status: "ready",
        approvedAt: new Date(),
        approvedById: session.userId,
      },
    }),
    prisma.encounter.update({
      where: { id: draft.encounterId },
      data: { reviewStatus: "approved" },
    }),
    prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: session.userId,
        action: "build.draft.approved",
        resource: "claim_draft",
        metadata: { draftId },
      },
    }),
  ]);

  revalidatePath(`/o/${orgSlug}/build`, "page");
  revalidatePath(`/o/${orgSlug}/build/encounters/${draft.encounterId}`, "page");
}

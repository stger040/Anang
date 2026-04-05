"use server";

import { platformLog, readRequestIdFromHeaders } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { parseStaffModuleKeysFromForm } from "@/lib/staff-module-form";
import { getSession } from "@/lib/session";
import { isTenantSettingsEditor } from "@/lib/tenant-admin-guard";
import { assertOrgAccess } from "@/lib/tenant-context";
import { AppRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type UpdateStaffModulesState = { error?: string; ok?: boolean } | null;

/** Tenant admin / super-admin: set per-staff module allow list (STAFF only). */
export async function updateMembershipStaffModulesAction(
  _prev: UpdateStaffModulesState,
  formData: FormData,
): Promise<UpdateStaffModulesState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const membershipId = String(formData.get("membershipId") ?? "").trim();
  if (!orgSlug || !membershipId) {
    return { error: "Invalid payload." };
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error:
        "Only tenant admins or platform super admins can update staff module access.",
    };
  }

  const row = await tenantPrisma(orgSlug).membership.findFirst({
    where: { id: membershipId, tenantId: ctx.tenant.id },
  });
  if (!row) return { error: "Membership not found." };
  if (row.role !== AppRole.STAFF) {
    return { error: "Module restrictions apply to staff members only." };
  }

  const staffAllowList = parseStaffModuleKeysFromForm(formData);

  await tenantPrisma(orgSlug).membership.update({
    where: { id: membershipId },
    data: { staffModuleAllowList: staffAllowList },
  });

  const requestId = await readRequestIdFromHeaders();
  await tenantPrisma(orgSlug).auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "tenant.membership.staff_modules_updated",
      resource: "membership",
      metadata: {
        membershipId,
        targetUserId: row.userId,
        staffModuleAllowList: staffAllowList.length
          ? [...staffAllowList].sort()
          : [],
        unrestricted: staffAllowList.length === 0,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "tenant.membership.staff_modules_updated", {
    tenantId: ctx.tenant.id,
    orgSlug,
    membershipId,
    moduleCount: staffAllowList.length,
    ...(requestId ? { requestId } : {}),
  });

  revalidatePath(`/o/${orgSlug}/settings/users`, "page");
  return { ok: true };
}

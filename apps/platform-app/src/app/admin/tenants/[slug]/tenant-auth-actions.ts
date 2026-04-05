"use server";

import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import { getSession } from "@/lib/session";
import {
  TENANT_AUTH_POLICIES,
  type TenantAuthPolicy,
  type TenantJitMembershipRole,
} from "@/lib/tenant-auth-settings";
import { AppRole } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type TenantAuthActionState = { error: string } | { ok: true } | null;

export async function updateTenantAuthSettings(
  _prev: TenantAuthActionState,
  formData: FormData,
): Promise<TenantAuthActionState> {
  const session = await getSession();
  if (!session || session.appRole !== AppRole.SUPER_ADMIN) {
    return { error: "Only platform super admins can change tenant auth." };
  }

  const slug = validateTenantSlug(String(formData.get("slug") ?? ""));
  if (!slug) return { error: "Invalid organization slug." };

  const policyRaw = String(formData.get("policy") ?? "").trim();
  if (!TENANT_AUTH_POLICIES.includes(policyRaw as TenantAuthPolicy)) {
    return { error: "Invalid auth policy." };
  }
  const policy = policyRaw as TenantAuthPolicy;

  const issuer = String(formData.get("issuer") ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const clearOidc = formData.get("clearOidc") === "on";
  const jitProvisioning = formData.get("jitProvisioning") === "on";
  const jitRoleRaw = String(formData.get("jitMembershipRole") ?? "STAFF").trim();
  const jitMembershipRole: TenantJitMembershipRole =
    jitRoleRaw === "TENANT_ADMIN" ? "TENANT_ADMIN" : "STAFF";

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return { error: "Tenant not found." };

  const base =
    tenant.settings && typeof tenant.settings === "object" && !Array.isArray(tenant.settings)
      ? { ...(tenant.settings as Record<string, unknown>) }
      : {};

  let oidc: { issuer: string; clientId: string } | undefined;
  if (!clearOidc && issuer && clientId) {
    oidc = { issuer, clientId };
  }

  const auth = {
    version: 1 as const,
    policy,
    jitMembershipRole,
    ...(jitProvisioning ? { jitProvisioning: true as const } : {}),
    ...(oidc ? { oidc } : {}),
  };

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      settings: {
        ...base,
        auth,
      },
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: session.userId,
      action: "platform.tenant_auth.updated",
      resource: "tenant",
      metadata: {
        policy,
        hasOidc: !!oidc,
        jitProvisioning,
        jitMembershipRole,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${slug}`);
  return { ok: true };
}

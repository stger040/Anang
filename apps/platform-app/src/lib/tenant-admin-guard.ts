import type { SessionPayload } from "@/lib/session";
import { AppRole } from "@prisma/client";

/**
 * Tenant "Admin" shell routes (`/o/.../settings/**`): org-level settings, users, audit, entitlements UI.
 * Staff memberships must not browse here; platform super-admins always may (support / provisioning).
 */
export function canAccessTenantAdminRoutes(
  session: SessionPayload,
  membershipRole: AppRole | null,
): boolean {
  if (session.appRole === AppRole.SUPER_ADMIN) return true;
  return membershipRole === AppRole.TENANT_ADMIN;
}

/**
 * Tenant settings edits + FHIR fixture import: super admin or tenant admin
 * membership loaded by `assertOrgAccess` from the same tenant DB that writes use.
 */
export async function isTenantSettingsEditor(
  session: SessionPayload,
  membershipRole: AppRole | null,
): Promise<boolean> {
  return canAccessTenantAdminRoutes(session, membershipRole);
}

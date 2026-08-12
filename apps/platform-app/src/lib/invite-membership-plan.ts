import { AppRole, type ModuleKey } from "@prisma/client";

/** Tenant-side membership privilege rank — higher must never be overwritten by invite fulfill. */
export function membershipPrivilegeRank(role: AppRole): number {
  if (role === AppRole.SUPER_ADMIN) return 3;
  if (role === AppRole.TENANT_ADMIN) return 2;
  return 1;
}

export type InviteMembershipPlan = {
  role: AppRole;
  staffModuleAllowList: ModuleKey[];
  /** When false, existing membership fields must be left unchanged (invite still consumed). */
  applyUpdate: boolean;
};

/**
 * Invites must never reduce access. Upgrade STAFF→TENANT_ADMIN; keep TENANT_ADMIN when a
 * later STAFF invite is consumed; do not shrink an existing STAFF allow-list.
 */
export function planInviteMembershipUpdate(args: {
  existing: { role: AppRole; staffModuleAllowList: ModuleKey[] } | null;
  inviteRole: AppRole;
  inviteStaffModuleAllowList: ModuleKey[];
}): InviteMembershipPlan {
  let inviteRole = args.inviteRole;
  if (inviteRole === AppRole.SUPER_ADMIN) {
    inviteRole = AppRole.TENANT_ADMIN;
  }
  const inviteAllow =
    inviteRole === AppRole.STAFF ? args.inviteStaffModuleAllowList : [];

  if (!args.existing) {
    return {
      role: inviteRole,
      staffModuleAllowList: inviteAllow,
      applyUpdate: true,
    };
  }

  if (
    membershipPrivilegeRank(inviteRole) >
    membershipPrivilegeRank(args.existing.role)
  ) {
    return {
      role: inviteRole,
      staffModuleAllowList: inviteAllow,
      applyUpdate: true,
    };
  }

  return {
    role: args.existing.role,
    staffModuleAllowList: args.existing.staffModuleAllowList,
    applyUpdate: false,
  };
}

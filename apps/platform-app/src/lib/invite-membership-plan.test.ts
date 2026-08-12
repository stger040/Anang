import { AppRole, ModuleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  membershipPrivilegeRank,
  planInviteMembershipUpdate,
} from "./invite-membership-plan";

describe("membershipPrivilegeRank", () => {
  it("orders SUPER_ADMIN > TENANT_ADMIN > STAFF", () => {
    expect(membershipPrivilegeRank(AppRole.SUPER_ADMIN)).toBeGreaterThan(
      membershipPrivilegeRank(AppRole.TENANT_ADMIN),
    );
    expect(membershipPrivilegeRank(AppRole.TENANT_ADMIN)).toBeGreaterThan(
      membershipPrivilegeRank(AppRole.STAFF),
    );
  });
});

describe("planInviteMembershipUpdate", () => {
  it("creates from invite when no membership exists", () => {
    expect(
      planInviteMembershipUpdate({
        existing: null,
        inviteRole: AppRole.STAFF,
        inviteStaffModuleAllowList: [ModuleKey.PAY],
      }),
    ).toEqual({
      role: AppRole.STAFF,
      staffModuleAllowList: [ModuleKey.PAY],
      applyUpdate: true,
    });
  });

  it("does not demote TENANT_ADMIN when a STAFF invite is consumed", () => {
    expect(
      planInviteMembershipUpdate({
        existing: {
          role: AppRole.TENANT_ADMIN,
          staffModuleAllowList: [],
        },
        inviteRole: AppRole.STAFF,
        inviteStaffModuleAllowList: [ModuleKey.PAY],
      }),
    ).toEqual({
      role: AppRole.TENANT_ADMIN,
      staffModuleAllowList: [],
      applyUpdate: false,
    });
  });

  it("upgrades STAFF to TENANT_ADMIN from a higher invite", () => {
    expect(
      planInviteMembershipUpdate({
        existing: {
          role: AppRole.STAFF,
          staffModuleAllowList: [ModuleKey.PAY],
        },
        inviteRole: AppRole.TENANT_ADMIN,
        inviteStaffModuleAllowList: [],
      }),
    ).toEqual({
      role: AppRole.TENANT_ADMIN,
      staffModuleAllowList: [],
      applyUpdate: true,
    });
  });

  it("does not shrink an existing STAFF allow-list via a later STAFF invite", () => {
    expect(
      planInviteMembershipUpdate({
        existing: {
          role: AppRole.STAFF,
          staffModuleAllowList: [],
        },
        inviteRole: AppRole.STAFF,
        inviteStaffModuleAllowList: [ModuleKey.PAY],
      }),
    ).toEqual({
      role: AppRole.STAFF,
      staffModuleAllowList: [],
      applyUpdate: false,
    });
  });

  it("maps SUPER_ADMIN invite role down to TENANT_ADMIN on create", () => {
    expect(
      planInviteMembershipUpdate({
        existing: null,
        inviteRole: AppRole.SUPER_ADMIN,
        inviteStaffModuleAllowList: [ModuleKey.BUILD],
      }),
    ).toEqual({
      role: AppRole.TENANT_ADMIN,
      staffModuleAllowList: [],
      applyUpdate: true,
    });
  });
});

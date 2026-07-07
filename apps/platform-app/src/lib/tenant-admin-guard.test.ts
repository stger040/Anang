import { AppRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { SessionPayload } from "@/lib/session";

import {
  canAccessTenantAdminRoutes,
  isTenantSettingsEditor,
} from "./tenant-admin-guard";

const staffSession: SessionPayload = {
  userId: "u1",
  email: "staff@test",
  appRole: AppRole.STAFF,
};

const superAdminSession: SessionPayload = {
  userId: "u2",
  email: "super@test",
  appRole: AppRole.SUPER_ADMIN,
};

describe("tenant admin guard", () => {
  it("allows super admins even without tenant membership", async () => {
    expect(canAccessTenantAdminRoutes(superAdminSession, null)).toBe(true);
    await expect(isTenantSettingsEditor(superAdminSession, null)).resolves.toBe(true);
  });

  it("allows tenant admins based on the tenant-scoped membership role", async () => {
    expect(canAccessTenantAdminRoutes(staffSession, AppRole.TENANT_ADMIN)).toBe(true);
    await expect(
      isTenantSettingsEditor(staffSession, AppRole.TENANT_ADMIN),
    ).resolves.toBe(true);
  });

  it("rejects staff even if a stale primary database might disagree", async () => {
    expect(canAccessTenantAdminRoutes(staffSession, AppRole.STAFF)).toBe(false);
    await expect(isTenantSettingsEditor(staffSession, AppRole.STAFF)).resolves.toBe(
      false,
    );
  });
});

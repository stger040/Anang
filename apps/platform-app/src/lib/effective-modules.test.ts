import { AppRole, ModuleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computeEffectiveModules } from "./effective-modules";
import type { SessionPayload } from "./session";

describe("computeEffectiveModules", () => {
  const staffSession: SessionPayload = {
    userId: "u1",
    email: "s@t.test",
    appRole: AppRole.STAFF,
  };

  it("returns full tenant set for staff when allow list empty", () => {
    const tenant = new Set([
      ModuleKey.PAY,
      ModuleKey.BUILD,
      ModuleKey.CORE,
    ]);
    const out = computeEffectiveModules(staffSession, tenant, {
      role: AppRole.STAFF,
      staffModuleAllowList: [],
    });
    expect(out).toEqual(tenant);
  });

  it("intersects staff allow list with tenant entitlements", () => {
    const tenant = new Set([ModuleKey.PAY, ModuleKey.BUILD]);
    const out = computeEffectiveModules(staffSession, tenant, {
      role: AppRole.STAFF,
      staffModuleAllowList: [ModuleKey.PAY],
    });
    expect([...out].sort()).toEqual([ModuleKey.PAY]);
  });

  it("tenant admin ignores allow list", () => {
    const tenant = new Set([ModuleKey.PAY]);
    const out = computeEffectiveModules(staffSession, tenant, {
      role: AppRole.TENANT_ADMIN,
      staffModuleAllowList: [],
    });
    expect(out).toEqual(tenant);
  });

  it("super admin gets full tenant set", () => {
    const adminSession: SessionPayload = {
      ...staffSession,
      appRole: AppRole.SUPER_ADMIN,
    };
    const tenant = new Set([ModuleKey.CONNECT]);
    const out = computeEffectiveModules(adminSession, tenant, null);
    expect(out).toEqual(tenant);
  });
});

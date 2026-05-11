import { AppRole, ModuleKey } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SessionPayload } from "./session";

const mocks = vi.hoisted(() => ({
  assertOrgAccess: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  getSession: mocks.getSession,
}));

vi.mock("@/lib/tenant-context", () => ({
  assertOrgAccess: mocks.assertOrgAccess,
}));

import { loadTenantWorkspacePageContext } from "./workspace-page-context";

describe("loadTenantWorkspacePageContext", () => {
  const session: SessionPayload = {
    userId: "u1",
    email: "staff@test",
    appRole: AppRole.STAFF,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(session);
  });

  it("returns null when a restricted staff user lacks the required module", async () => {
    mocks.assertOrgAccess.mockResolvedValue({
      tenant: {
        id: "t1",
        slug: "acme",
        name: "Acme",
        displayName: "Acme",
        primaryColor: "#000000",
        logoUrl: null,
      },
      enabledModules: new Set([ModuleKey.BUILD, ModuleKey.PAY]),
      effectiveModules: new Set([ModuleKey.PAY]),
      membershipRole: AppRole.STAFF,
    });

    await expect(
      loadTenantWorkspacePageContext("acme", ModuleKey.BUILD),
    ).resolves.toBeNull();
  });

  it("returns context when the required module is effective", async () => {
    mocks.assertOrgAccess.mockResolvedValue({
      tenant: {
        id: "t1",
        slug: "acme",
        name: "Acme",
        displayName: "Acme",
        primaryColor: "#000000",
        logoUrl: null,
      },
      enabledModules: new Set([ModuleKey.BUILD, ModuleKey.PAY]),
      effectiveModules: new Set([ModuleKey.PAY]),
      membershipRole: AppRole.STAFF,
    });

    const out = await loadTenantWorkspacePageContext("acme", ModuleKey.PAY);

    expect(out?.ctx.tenant.id).toBe("t1");
    expect(out?.operational).toEqual([ModuleKey.PAY]);
  });
});

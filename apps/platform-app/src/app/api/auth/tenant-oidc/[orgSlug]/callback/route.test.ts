import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookiesGet: vi.fn(),
  discoveryRequest: vi.fn(),
  loadTenantAuthRow: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mocks.cookiesGet,
  })),
}));

vi.mock("oauth4webapi", () => ({
  discoveryRequest: mocks.discoveryRequest,
}));

vi.mock("@/lib/app-origin", () => ({
  getAppOrigin: () => "https://app.example.test",
}));

vi.mock("@/lib/auth-cookie-session", () => ({
  applySessionCookieToResponse: vi.fn(),
  encodeAuthJsSessionValue: vi.fn(),
}));

vi.mock("@/lib/platform-log", () => ({
  platformLog: vi.fn(),
  readRequestId: vi.fn(() => undefined),
}));

vi.mock("@/lib/prisma", () => ({
  tenantPrisma: vi.fn(),
}));

vi.mock("@/lib/tenant-auth-queries", () => ({
  loadTenantAuthRow: mocks.loadTenantAuthRow,
  tenantJitMembershipAppRole: vi.fn(() => "STAFF"),
}));

import { GET } from "./route";

describe("tenant OIDC callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookiesGet.mockReturnValue({
      value: JSON.stringify({
        slug: "acme",
        state: "state-123",
        code_verifier: "verifier-123",
        nonce: null,
        pendingInviteToken: null,
      }),
    });
  });

  it("rejects direct callbacks when the tenant policy is local_only", async () => {
    mocks.loadTenantAuthRow.mockResolvedValue({
      id: "tenant_1",
      slug: "acme",
      displayName: "Acme Health",
      settings: {
        auth: {
          version: 1,
          policy: "local_only",
          jitProvisioning: true,
          oidc: {
            issuer: "https://idp.example.test",
            clientId: "client_123",
          },
        },
      },
    });

    const res = await GET(
      new Request(
        "https://app.example.test/api/auth/tenant-oidc/acme/callback?state=state-123&code=code-123",
      ),
      { params: Promise.resolve({ orgSlug: "acme" }) },
    );

    expect(res.headers.get("location")).toBe(
      "https://app.example.test/login?org=acme&error=sso_not_enabled",
    );
    expect(mocks.discoveryRequest).not.toHaveBeenCalled();
  });
});

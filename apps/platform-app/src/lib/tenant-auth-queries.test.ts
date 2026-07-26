import { describe, expect, it } from "vitest";

import { credentialsSessionAllowedForTenantPolicy } from "./tenant-auth-queries";

describe("credentialsSessionAllowedForTenantPolicy", () => {
  it("allows non-password sessions into sso_required tenants", () => {
    expect(
      credentialsSessionAllowedForTenantPolicy("sso_required", {
        isSuperAdmin: false,
        authViaCredentials: false,
      }),
    ).toBe(true);
  });

  it("blocks staff password sessions from sso_required tenants", () => {
    expect(
      credentialsSessionAllowedForTenantPolicy("sso_required", {
        isSuperAdmin: false,
        authViaCredentials: true,
      }),
    ).toBe(false);
  });

  it("allows super-admin password sessions into sso_required tenants", () => {
    expect(
      credentialsSessionAllowedForTenantPolicy("sso_required", {
        isSuperAdmin: true,
        authViaCredentials: true,
      }),
    ).toBe(true);
  });

  it("allows staff password sessions into local_only and sso_allowed", () => {
    for (const policy of ["local_only", "sso_allowed"] as const) {
      expect(
        credentialsSessionAllowedForTenantPolicy(policy, {
          isSuperAdmin: false,
          authViaCredentials: true,
        }),
      ).toBe(true);
    }
  });
});

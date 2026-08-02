import { AppRole } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import {
  applyAuthSessionUserToToken,
  loadAuthSessionUser,
} from "./auth-session-user";

describe("loadAuthSessionUser", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns null for blank user ids without querying", async () => {
    await expect(loadAuthSessionUser("  ")).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns the live appRole from the database", async () => {
    findUnique.mockResolvedValue({
      id: "u1",
      email: "ops@anang.ai",
      appRole: AppRole.STAFF,
    });
    await expect(loadAuthSessionUser("u1")).resolves.toEqual({
      id: "u1",
      email: "ops@anang.ai",
      appRole: AppRole.STAFF,
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "u1" },
      select: { id: true, email: true, appRole: true },
    });
  });

  it("returns null when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);
    await expect(loadAuthSessionUser("missing")).resolves.toBeNull();
  });
});

describe("applyAuthSessionUserToToken", () => {
  it("overwrites a stale SUPER_ADMIN claim with the live STAFF role", () => {
    const next = applyAuthSessionUserToToken(
      {
        sub: "u1",
        email: "ops@anang.ai",
        appRole: AppRole.SUPER_ADMIN,
      },
      {
        id: "u1",
        email: "ops@anang.ai",
        appRole: AppRole.STAFF,
      },
    );
    expect(next).toEqual({
      sub: "u1",
      email: "ops@anang.ai",
      appRole: AppRole.STAFF,
    });
  });

  it("returns null so Auth.js can invalidate deleted users", () => {
    expect(
      applyAuthSessionUserToToken(
        { sub: "u1", email: "gone@anang.ai", appRole: AppRole.SUPER_ADMIN },
        null,
      ),
    ).toBeNull();
  });
});

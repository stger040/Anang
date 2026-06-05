import { ModuleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { canShowStatementPriorAuthLinks } from "./statement-prior-auth-links";

describe("canShowStatementPriorAuthLinks", () => {
  it("hides Connect prior-auth identifiers from Pay-only staff", () => {
    expect(canShowStatementPriorAuthLinks(new Set([ModuleKey.PAY]))).toBe(false);
  });

  it("allows prior-auth links when Connect is in the effective access set", () => {
    expect(
      canShowStatementPriorAuthLinks(
        new Set([ModuleKey.PAY, ModuleKey.CONNECT]),
      ),
    ).toBe(true);
  });
});

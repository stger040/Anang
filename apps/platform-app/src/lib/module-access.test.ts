import { ModuleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { hasEffectiveModule } from "./module-access";

describe("hasEffectiveModule", () => {
  it("allows direct cross-module data only when the session has that module", () => {
    const payOnly = new Set([ModuleKey.PAY]);

    expect(hasEffectiveModule(payOnly, ModuleKey.PAY)).toBe(true);
    expect(hasEffectiveModule(payOnly, ModuleKey.CONNECT)).toBe(false);
  });

  it("supports serialized effective module arrays", () => {
    expect(hasEffectiveModule([ModuleKey.CONNECT], ModuleKey.CONNECT)).toBe(true);
  });
});

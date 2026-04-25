import { ModuleKey } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { requireConnectModule } from "./require-connect-module";

describe("requireConnectModule", () => {
  it("throws when CONNECT is not entitled", () => {
    expect(() =>
      requireConnectModule(new Set([ModuleKey.BUILD, ModuleKey.PAY])),
    ).toThrow("Forbidden");
  });

  it("passes when CONNECT is entitled", () => {
    expect(() =>
      requireConnectModule(new Set([ModuleKey.CONNECT, ModuleKey.BUILD])),
    ).not.toThrow();
  });
});

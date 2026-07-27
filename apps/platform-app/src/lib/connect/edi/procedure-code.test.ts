import { describe, expect, it } from "vitest";

import { normalizeProcedureCode } from "./procedure-code";

describe("normalizeProcedureCode", () => {
  it("preserves numeric CPT codes", () => {
    expect(normalizeProcedureCode("99213")).toBe("99213");
    expect(normalizeProcedureCode(" 93000 ")).toBe("93000");
  });

  it("preserves alphanumeric HCPCS Level II codes", () => {
    expect(normalizeProcedureCode("J1100")).toBe("J1100");
    expect(normalizeProcedureCode("j1100")).toBe("J1100");
    expect(normalizeProcedureCode("E0601")).toBe("E0601");
    expect(normalizeProcedureCode("G0438")).toBe("G0438");
    expect(normalizeProcedureCode("A0428")).toBe("A0428");
  });

  it("strips separators without dropping letters", () => {
    expect(normalizeProcedureCode("J-1100")).toBe("J1100");
    expect(normalizeProcedureCode("E0601*")).toBe("E0601");
  });
});

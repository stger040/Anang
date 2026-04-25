import { PriorAuthStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { assertLegalPriorAuthTransition, canTransitionPriorAuthStatus } from "./transitions";

describe("canTransitionPriorAuthStatus", () => {
  it("allows identity", () => {
    expect(
      canTransitionPriorAuthStatus(PriorAuthStatus.DRAFT, PriorAuthStatus.DRAFT),
    ).toBe(true);
  });

  it("allows draft to intake", () => {
    expect(
      canTransitionPriorAuthStatus(PriorAuthStatus.DRAFT, PriorAuthStatus.INTAKE),
    ).toBe(true);
  });

  it("disallows draft to approved", () => {
    expect(
      canTransitionPriorAuthStatus(PriorAuthStatus.DRAFT, PriorAuthStatus.APPROVED),
    ).toBe(false);
  });

  it("allows denied to rework", () => {
    expect(
      canTransitionPriorAuthStatus(PriorAuthStatus.DENIED, PriorAuthStatus.REWORK),
    ).toBe(true);
  });
});

describe("assertLegalPriorAuthTransition", () => {
  it("throws on illegal move", () => {
    expect(() =>
      assertLegalPriorAuthTransition(
        PriorAuthStatus.CANCELLED,
        PriorAuthStatus.DRAFT,
      ),
    ).toThrow(/Illegal prior auth status transition/);
  });
});

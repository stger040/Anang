import { describe, expect, it } from "vitest";

import { calculateStatementPaymentApplication } from "./statement-payment-application";

describe("calculateStatementPaymentApplication", () => {
  it("applies a normal full payment to the current balance", () => {
    expect(
      calculateStatementPaymentApplication({
        currentBalanceCents: 12500,
        capturedCents: 12500,
      }),
    ).toEqual({
      capturedCents: 12500,
      appliedCents: 12500,
      overpaymentCents: 0,
      nextBalanceCents: 0,
    });
  });

  it("only applies the remaining balance when a stale checkout overpays", () => {
    expect(
      calculateStatementPaymentApplication({
        currentBalanceCents: 0,
        capturedCents: 12500,
      }),
    ).toEqual({
      capturedCents: 12500,
      appliedCents: 0,
      overpaymentCents: 12500,
      nextBalanceCents: 0,
    });
  });

  it("supports partial captures without making the balance negative", () => {
    expect(
      calculateStatementPaymentApplication({
        currentBalanceCents: 12500,
        capturedCents: 5000,
      }),
    ).toEqual({
      capturedCents: 5000,
      appliedCents: 5000,
      overpaymentCents: 0,
      nextBalanceCents: 7500,
    });
  });
});

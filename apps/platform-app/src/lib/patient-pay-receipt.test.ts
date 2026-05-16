import { describe, expect, it } from "vitest";

import { stripeSessionMatchesPatientPaidStatement } from "./patient-pay-receipt";

describe("stripeSessionMatchesPatientPaidStatement", () => {
  it("accepts a paid Stripe session for the signed statement and tenant", () => {
    expect(
      stripeSessionMatchesPatientPaidStatement({
        tenantId: "tenant_1",
        statementId: "stmt_1",
        session: {
          payment_status: "paid",
          metadata: { tenantId: "tenant_1", statementId: "stmt_1" },
        },
      }),
    ).toBe(true);
  });

  it("does not allow a Stripe session to replace a missing token statement", () => {
    expect(
      stripeSessionMatchesPatientPaidStatement({
        tenantId: "tenant_1",
        statementId: null,
        session: {
          payment_status: "paid",
          metadata: { tenantId: "tenant_1", statementId: "stmt_2" },
        },
      }),
    ).toBe(false);
  });

  it("rejects a paid Stripe session for a different statement", () => {
    expect(
      stripeSessionMatchesPatientPaidStatement({
        tenantId: "tenant_1",
        statementId: "stmt_1",
        session: {
          payment_status: "paid",
          metadata: { tenantId: "tenant_1", statementId: "stmt_2" },
        },
      }),
    ).toBe(false);
  });
});

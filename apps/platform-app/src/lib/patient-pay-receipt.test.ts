import { describe, expect, it } from "vitest";

import { resolvePatientPayReceiptStatementId } from "./patient-pay-receipt";

describe("resolvePatientPayReceiptStatementId", () => {
  it("keeps a valid token-bound statement when a paid session points elsewhere", () => {
    expect(
      resolvePatientPayReceiptStatementId({
        tokenStatementId: "stmt_token",
        tenantId: "tenant_1",
        stripePaymentStatus: "paid",
        stripeTenantId: "tenant_1",
        stripeStatementId: "stmt_other",
      }),
    ).toBe("stmt_token");
  });

  it("uses a paid matching session for receipt lookup", () => {
    expect(
      resolvePatientPayReceiptStatementId({
        tokenStatementId: "stmt_token",
        tenantId: "tenant_1",
        stripePaymentStatus: "paid",
        stripeTenantId: "tenant_1",
        stripeStatementId: "stmt_token",
      }),
    ).toBe("stmt_token");
  });

  it("allows a paid session to recover the statement when the token is expired", () => {
    expect(
      resolvePatientPayReceiptStatementId({
        tokenStatementId: null,
        tenantId: "tenant_1",
        stripePaymentStatus: "paid",
        stripeTenantId: "tenant_1",
        stripeStatementId: "stmt_session",
      }),
    ).toBe("stmt_session");
  });
});

import { describe, expect, it } from "vitest";

import {
  classifyStripeCheckoutPostFailure,
  stripeCheckoutWebhookHttpStatus,
} from "@/lib/pay/stripe-checkout-webhook-result";

describe("classifyStripeCheckoutPostFailure", () => {
  it("requests retry when the ledger payment was not created", () => {
    expect(
      classifyStripeCheckoutPostFailure({ paymentExistsAfterFailure: false }),
    ).toBe("retry");
    expect(stripeCheckoutWebhookHttpStatus("retry")).toBe(500);
  });

  it("ACKs when a concurrent delivery already posted the payment", () => {
    expect(
      classifyStripeCheckoutPostFailure({ paymentExistsAfterFailure: true }),
    ).toBe("ok");
    expect(stripeCheckoutWebhookHttpStatus("ok")).toBe(200);
  });
});

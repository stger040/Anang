import { describe, expect, it } from "vitest";
import {
  isStripeCheckoutFulfillmentEvent,
  isStripeCheckoutPaymentSettled,
} from "./stripe-checkout-settled";

describe("isStripeCheckoutPaymentSettled", () => {
  it("posts only when payment_status is paid", () => {
    expect(isStripeCheckoutPaymentSettled({ payment_status: "paid" })).toBe(
      true,
    );
  });

  it("does not post unpaid async checkout.session.completed payloads", () => {
    expect(isStripeCheckoutPaymentSettled({ payment_status: "unpaid" })).toBe(
      false,
    );
  });

  it("does not treat no_payment_required as a Pay statement settlement", () => {
    expect(
      isStripeCheckoutPaymentSettled({
        payment_status: "no_payment_required",
      }),
    ).toBe(false);
  });
});

describe("isStripeCheckoutFulfillmentEvent", () => {
  it("accepts completed and async_payment_succeeded", () => {
    expect(isStripeCheckoutFulfillmentEvent("checkout.session.completed")).toBe(
      true,
    );
    expect(
      isStripeCheckoutFulfillmentEvent(
        "checkout.session.async_payment_succeeded",
      ),
    ).toBe(true);
  });

  it("ignores async failures and unrelated events", () => {
    expect(
      isStripeCheckoutFulfillmentEvent("checkout.session.async_payment_failed"),
    ).toBe(false);
    expect(isStripeCheckoutFulfillmentEvent("charge.succeeded")).toBe(false);
  });
});

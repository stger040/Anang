/**
 * Stripe Checkout settlement helpers for webhook fulfillment.
 *
 * Delayed methods (ACH, bank transfer, SEPA, etc.) emit
 * `checkout.session.completed` with `payment_status: "unpaid"`. Funds only
 * settle on a later `checkout.session.async_payment_succeeded` (or fail via
 * `checkout.session.async_payment_failed`). Posting ledger entries on the
 * unpaid completed event marks statements paid before money clears.
 *
 * @see https://docs.stripe.com/checkout/fulfillment
 */

export type StripeCheckoutPaymentStatus = "paid" | "unpaid" | "no_payment_required" | string;

/** True when Checkout funds are settled and safe to post to the ledger. */
export function isStripeCheckoutPaymentSettled(session: {
  payment_status: StripeCheckoutPaymentStatus;
}): boolean {
  return session.payment_status === "paid";
}

/** Event types that may carry a settled Checkout Session to fulfill. */
export function isStripeCheckoutFulfillmentEvent(type: string): boolean {
  return (
    type === "checkout.session.completed" ||
    type === "checkout.session.async_payment_succeeded"
  );
}

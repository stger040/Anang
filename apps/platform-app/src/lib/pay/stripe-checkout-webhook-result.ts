/**
 * Stripe retries webhook deliveries when the endpoint returns a non-2xx status.
 * After a failed checkout ledger post, we must not ACK success or the charge is
 * permanently missing from Statement/Payment rows.
 */

export type StripeCheckoutWebhookPostResult = "ok" | "retry";

/**
 * Classify a failed checkout posting attempt.
 * If another worker already inserted the Payment (unique session id), ACK.
 * Otherwise ask Stripe to retry.
 */
export function classifyStripeCheckoutPostFailure(args: {
  paymentExistsAfterFailure: boolean;
}): StripeCheckoutWebhookPostResult {
  return args.paymentExistsAfterFailure ? "ok" : "retry";
}

export function stripeCheckoutWebhookHttpStatus(
  result: StripeCheckoutWebhookPostResult,
): number {
  return result === "retry" ? 500 : 200;
}

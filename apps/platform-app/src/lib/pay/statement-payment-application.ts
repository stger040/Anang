export type StatementPaymentApplication = {
  capturedCents: number;
  appliedCents: number;
  overpaymentCents: number;
  nextBalanceCents: number;
};

/**
 * Stripe Checkout captures the amount from the session that was created earlier.
 * If another payment posted first, only the remaining statement balance should
 * be applied to the statement or payment plan; the full capture stays auditable.
 */
export function calculateStatementPaymentApplication(args: {
  currentBalanceCents: number;
  capturedCents: number;
}): StatementPaymentApplication {
  const capturedCents = Math.max(0, args.capturedCents);
  const currentBalanceCents = Math.max(0, args.currentBalanceCents);
  const appliedCents = Math.min(currentBalanceCents, capturedCents);
  return {
    capturedCents,
    appliedCents,
    overpaymentCents: capturedCents - appliedCents,
    nextBalanceCents: currentBalanceCents - appliedCents,
  };
}

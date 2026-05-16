export type PatientPaidStripeSession = {
  payment_status?: string | null;
  metadata?: {
    tenantId?: string | null;
    statementId?: string | null;
  } | null;
};

export function stripeSessionMatchesPatientPaidStatement(args: {
  session: PatientPaidStripeSession | null;
  tenantId: string;
  statementId: string | null;
}): boolean {
  if (!args.statementId || !args.session) return false;

  return (
    args.session.payment_status === "paid" &&
    args.session.metadata?.tenantId === args.tenantId &&
    args.session.metadata?.statementId === args.statementId
  );
}

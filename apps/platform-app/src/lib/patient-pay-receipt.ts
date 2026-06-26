export function resolvePatientPayReceiptStatementId(args: {
  tokenStatementId: string | null;
  tenantId: string;
  stripePaymentStatus?: string | null;
  stripeTenantId?: string | null;
  stripeStatementId?: string | null;
}): string | null {
  const tokenStatementId = args.tokenStatementId;
  const stripeStatementId = args.stripeStatementId?.trim() || null;
  if (
    args.stripePaymentStatus === "paid" &&
    args.stripeTenantId === args.tenantId &&
    stripeStatementId &&
    (!tokenStatementId || stripeStatementId === tokenStatementId)
  ) {
    return stripeStatementId;
  }

  return tokenStatementId;
}

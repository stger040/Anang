/**
 * Idempotent Pay-statement plan for FHIR/CSV patient-encounter import.
 *
 * Product rule (docs/CONNECTOR_STRATEGY.md, ENGINEERING_BACKLOG A3):
 * - No statement yet → create the base number.
 * - Unpaid statement for the encounter → replace lines/balance.
 * - Only paid statement(s) → create exactly one companion `${stmtNumber}-P`.
 * - Companion already exists → reuse it; never mint another open balance.
 */

export type ExistingStatementForImport = {
  id: string;
  number: string;
  paymentCount: number;
};

export type StatementImportPlan =
  | { action: "create"; number: string }
  | { action: "replace"; statementId: string; number: string }
  | { action: "reuse_paid"; statementId: string };

function stableFirst<T extends { id: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function planPatientEncounterStatementImport(args: {
  stmtNumber: string;
  existing: ExistingStatementForImport[];
}): StatementImportPlan {
  const unpaid = stableFirst(
    args.existing.filter((s) => s.paymentCount === 0),
  );
  if (unpaid) {
    const hasPaidSibling = args.existing.some((s) => s.paymentCount > 0);
    return {
      action: "replace",
      statementId: unpaid.id,
      number: hasPaidSibling ? `${args.stmtNumber}-P` : args.stmtNumber,
    };
  }

  if (args.existing.length === 0) {
    return { action: "create", number: args.stmtNumber };
  }

  const pNumber = `${args.stmtNumber}-P`;
  const existingP = stableFirst(
    args.existing.filter((s) => s.number === pNumber),
  );
  if (existingP) {
    return { action: "reuse_paid", statementId: existingP.id };
  }

  return { action: "create", number: pNumber };
}

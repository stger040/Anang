import type { Prisma } from "@prisma/client";

type TxWithExecuteRaw = {
  $executeRaw: Prisma.TransactionClient["$executeRaw"];
};

/**
 * Transaction-scoped Postgres advisory lock key for canonical Patient identity
 * derived from a FHIR (or CSV-as-FHIR) logical id.
 *
 * Concurrent imports/syncs of the same tenant+patient otherwise race on
 * `findFirst` + `create` (no unique constraint on Patient/Encounter/Statement
 * for this identity), duplicating patients, encounters, and open Pay balances.
 */
export function fhirIdentityAdvisoryLockKey(args: {
  tenantId: string;
  fhirPatientLogicalId?: string | null;
  fhirEncounterLogicalId?: string | null;
}): string {
  const tenant = args.tenantId.trim();
  const patient = args.fhirPatientLogicalId?.trim() || "";
  const encounter = args.fhirEncounterLogicalId?.trim() || "";
  if (patient) return `fhir-identity:v1:${tenant}:patient:${patient}`;
  if (encounter) return `fhir-identity:v1:${tenant}:encounter:${encounter}`;
  return `fhir-identity:v1:${tenant}:unkeyed`;
}

/** Holds until the surrounding transaction commits or rolls back. */
export async function lockFhirIdentityInTransaction(
  tx: TxWithExecuteRaw,
  args: {
    tenantId: string;
    fhirPatientLogicalId?: string | null;
    fhirEncounterLogicalId?: string | null;
  },
): Promise<void> {
  const key = fhirIdentityAdvisoryLockKey(args);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

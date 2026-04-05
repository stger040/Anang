/**
 * First-class connector boundary: all vendor/FHIR/CSV paths should converge on
 * canonical Prisma entities. Expand per docs/CONNECTOR_STRATEGY.md.
 */

import type { Prisma, PrismaClient } from "@prisma/client";

export type ConnectorKind =
  | "fhir_fixture"
  | "csv_upload"
  | "vendor_api"
  | "greenway_fhir"
  | "manual"
  | "edi_inbound"
  | "edi_outbound"
  /** Pharmacy e-claims (NCPDP-class); ingest workers deferred until contract (E2b2b6). */
  | "ncpdp_pharmacy";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function createIngestionBatch(
  db: DbClient,
  args: {
    tenantId: string;
    connectorKind: ConnectorKind;
    note?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return db.ingestionBatch.create({
    data: {
      tenantId: args.tenantId,
      connectorKind: args.connectorKind,
      note: args.note ?? null,
      metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}

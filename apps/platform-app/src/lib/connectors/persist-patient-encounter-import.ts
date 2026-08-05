/**
 * Shared transactional write for canonical Patient + Encounter (+ optional Pay Statement)
 * from a normalized encounter payload (FHIR fixture, CSV upload, etc.).
 */

import {
  findEncounterByFhirEncounterLogicalId,
  findPatientIdByFhirPatientLogicalId,
  recordFhirFixtureExternalIds,
} from "@/lib/connectors/external-identifiers";
import type { ConnectorKind } from "@/lib/connectors/canonical-ingest";
import { planPatientEncounterStatementImport } from "@/lib/connectors/patient-encounter-statement-plan";
import { createIngestionBatchRecordingRawPayload } from "@/lib/connectors/source-artifact";
import type {
  FhirClaimStatementLine,
  NormalizedFhirPatientEncounter,
} from "@/lib/fhir-fixture-import";
import type { PrismaClient } from "@prisma/client";

export const PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH =
  "PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH";

export type PersistPatientEncounterImportResult = {
  encounterId: string;
  statementId?: string;
  payStatementCreated: boolean;
  idempotentPatient: boolean;
  idempotentEncounter: boolean;
  statementReplaced: boolean;
  sourceArtifactMeta: {
    id: string;
    sha256Hex: string;
    byteLength: number;
    inlineStored: boolean;
    externalStored: boolean;
    storageUri: string | null;
  };
};

export async function persistPatientEncounterImport(
  prisma: PrismaClient,
  args: {
    tenantId: string;
    payEnabled: boolean;
    normalized: NormalizedFhirPatientEncounter;
    rawText: string;
    connectorKind: ConnectorKind;
    sourceKind: string;
    ingestMetadata: Record<string, unknown>;
    claimLines: FhirClaimStatementLine[];
    fromClaim: boolean;
    statementTotalCents: number;
    stubStatementCents: number;
    stubLineDescription: string;
    /** When set (e.g. CSV), skips FHIR-derived statement number logic. */
    statementNumberOverride?: string | null;
  },
): Promise<PersistPatientEncounterImportResult> {
  const d = args.normalized;
  const claimLines = args.claimLines;
  const fromClaim = args.fromClaim;

  return prisma.$transaction(async (tx) => {
    const ingest = await createIngestionBatchRecordingRawPayload(tx, {
      tenantId: args.tenantId,
      connectorKind: args.connectorKind,
      metadata: args.ingestMetadata,
      sourceKind: args.sourceKind,
      rawText: args.rawText,
    });
    const sourceArtifactMetaTx = {
      id: ingest.artifact.id,
      sha256Hex: ingest.artifact.sha256Hex,
      byteLength: ingest.artifact.byteLength,
      inlineStored: ingest.inlinePayloadStored,
      externalStored: ingest.externalStorageStored,
      storageUri: ingest.artifact.storageUri,
    };

    const existingPatientId = await findPatientIdByFhirPatientLogicalId(
      tx,
      args.tenantId,
      d.fhirPatientLogicalId,
    );
    const patient =
      existingPatientId != null
        ? await tx.patient.update({
            where: { id: existingPatientId, tenantId: args.tenantId },
            data: {
              mrn: d.mrn,
              firstName: d.firstName,
              lastName: d.lastName,
              dob: d.dob,
            },
          })
        : await tx.patient.create({
            data: {
              tenantId: args.tenantId,
              mrn: d.mrn,
              firstName: d.firstName,
              lastName: d.lastName,
              dob: d.dob,
            },
          });
    const ipat = existingPatientId != null;

    const existingEncRow = await findEncounterByFhirEncounterLogicalId(
      tx,
      args.tenantId,
      d.fhirEncounterLogicalId,
    );
    if (existingEncRow && existingEncRow.patientId !== patient.id) {
      throw new Error(PATIENT_ENCOUNTER_IMPORT_ENCOUNTER_PATIENT_MISMATCH);
    }

    const encounter =
      existingEncRow != null
        ? await tx.encounter.update({
            where: { id: existingEncRow.id, tenantId: args.tenantId },
            data: {
              patientId: patient.id,
              dateOfService: d.dateOfService,
              chiefComplaint: d.chiefComplaint,
              visitSummary: d.visitSummary,
            },
          })
        : await tx.encounter.create({
            data: {
              tenantId: args.tenantId,
              patientId: patient.id,
              dateOfService: d.dateOfService,
              chiefComplaint: d.chiefComplaint,
              visitSummary: d.visitSummary,
              reviewStatus: "queued",
            },
          });
    const ienc = existingEncRow != null;

    await recordFhirFixtureExternalIds(tx, {
      tenantId: args.tenantId,
      patientId: patient.id,
      encounterId: encounter.id,
      fhirPatientLogicalId: d.fhirPatientLogicalId,
      fhirEncounterLogicalId: d.fhirEncounterLogicalId,
    });

    if (!args.payEnabled) {
      return {
        encounterId: encounter.id,
        statementId: undefined,
        payStatementCreated: false,
        idempotentPatient: ipat,
        idempotentEncounter: ienc,
        statementReplaced: false,
        sourceArtifactMeta: sourceArtifactMetaTx,
      };
    }

    const due = new Date();
    due.setUTCDate(due.getUTCDate() + 30);
    const clmId = d.claimStatement?.claimLogicalId;
    const claimIds = d.claimStatement?.claimIds ?? [];
    const claimResourceCount = d.claimStatement?.claimResourceCount ?? 0;
    const multiClaim = claimResourceCount > 1;

    let stmtNumber: string;
    const override = args.statementNumberOverride?.trim();
    if (override) {
      stmtNumber = override;
    } else {
      const clmPart =
        clmId?.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toUpperCase() ?? "";
      stmtNumber = `FHIR-SBX-${patient.id.slice(-8).toUpperCase()}`;
      if (fromClaim) {
        if (multiClaim) {
          const key =
            claimIds.length > 0
              ? [...claimIds].sort().join("|")
              : `claims-${claimResourceCount}-${patient.id}`;
          const multiPart =
            key.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase() ||
            "MULTI";
          stmtNumber = `FHIR-CLM-MULTI-${multiPart}`;
        } else if (clmPart) {
          stmtNumber = `FHIR-CLM-${clmPart}`;
        } else {
          stmtNumber = `FHIR-CLM-${patient.id.slice(-8).toUpperCase()}`;
        }
      }
    }

    const existingStatements = await tx.statement.findMany({
      where: {
        tenantId: args.tenantId,
        encounterId: encounter.id,
      },
      select: {
        id: true,
        number: true,
        _count: { select: { payments: true } },
      },
    });
    const plan = planPatientEncounterStatementImport({
      stmtNumber,
      existing: existingStatements.map((s) => ({
        id: s.id,
        number: s.number,
        paymentCount: s._count.payments,
      })),
    });

    if (plan.action === "reuse_paid") {
      // Companion `-P` already exists (and has payments). Do not mint another
      // open balance — repeated re-imports must stay idempotent.
      return {
        encounterId: encounter.id,
        statementId: plan.statementId,
        payStatementCreated: false,
        idempotentPatient: ipat,
        idempotentEncounter: ienc,
        statementReplaced: false,
        sourceArtifactMeta: sourceArtifactMetaTx,
      };
    }

    let stmtId: string;
    let replaced = false;
    let created = false;

    if (plan.action === "replace") {
      await tx.statementLine.deleteMany({
        where: { statementId: plan.statementId },
      });
      await tx.statement.update({
        where: { id: plan.statementId },
        data: {
          number: plan.number,
          totalCents: args.statementTotalCents,
          balanceCents: args.statementTotalCents,
          status: "open",
          dueDate: due,
          patientId: patient.id,
        },
      });
      stmtId = plan.statementId;
      replaced = true;
    } else {
      const stmt = await tx.statement.create({
        data: {
          tenantId: args.tenantId,
          patientId: patient.id,
          encounterId: encounter.id,
          number: plan.number,
          totalCents: args.statementTotalCents,
          balanceCents: args.statementTotalCents,
          status: "open",
          dueDate: due,
        },
      });
      stmtId = stmt.id;
      created = true;
    }

    if (fromClaim) {
      await tx.statementLine.createMany({
        data: claimLines.map((line) => ({
          statementId: stmtId,
          code: line.code,
          description: line.description,
          amountCents: line.amountCents,
        })),
      });
    } else {
      await tx.statementLine.create({
        data: {
          statementId: stmtId,
          code: "VISIT",
          description: args.stubLineDescription,
          amountCents: args.stubStatementCents,
        },
      });
    }

    return {
      encounterId: encounter.id,
      statementId: stmtId,
      payStatementCreated: created || replaced,
      idempotentPatient: ipat,
      idempotentEncounter: ienc,
      statementReplaced: replaced,
      sourceArtifactMeta: sourceArtifactMetaTx,
    };
  });
}

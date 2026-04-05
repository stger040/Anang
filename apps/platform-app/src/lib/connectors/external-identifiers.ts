import type {
  CanonicalResourceType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Internal URN for FHIR `Patient.id` / `Encounter.id` from pasted bundles (pilot). */
export const ANANG_FHIR_PATIENT_REF = "https://anang.ai/ns/fhir/Patient/id";
export const ANANG_FHIR_ENCOUNTER_REF = "https://anang.ai/ns/fhir/Encounter/id";

/** Patient-only FHIR logical id map (e.g. Greenway sync with zero Encounters returned). */
export async function recordFhirPatientExternalIdOnly(
  db: DbClient,
  args: {
    tenantId: string;
    patientId: string;
    fhirPatientLogicalId: string | null | undefined;
  },
): Promise<void> {
  if (!args.fhirPatientLogicalId?.trim()) return;
  await db.externalIdentifier.upsert({
    where: {
      tenantId_resourceType_system_value: {
        tenantId: args.tenantId,
        resourceType: "PATIENT",
        system: ANANG_FHIR_PATIENT_REF,
        value: args.fhirPatientLogicalId.trim(),
      },
    },
    create: {
      tenantId: args.tenantId,
      resourceType: "PATIENT",
      resourceId: args.patientId,
      system: ANANG_FHIR_PATIENT_REF,
      value: args.fhirPatientLogicalId.trim(),
    },
    update: { resourceId: args.patientId },
  });
}

export async function recordFhirFixtureExternalIds(
  db: DbClient,
  args: {
    tenantId: string;
    patientId: string;
    encounterId: string;
    fhirPatientLogicalId?: string | null;
    fhirEncounterLogicalId?: string | null;
  },
): Promise<void> {
  const rows: Array<{
    tenantId: string;
    resourceType: CanonicalResourceType;
    resourceId: string;
    system: string;
    value: string;
  }> = [];

  if (
    args.fhirPatientLogicalId &&
    args.fhirPatientLogicalId.trim().length > 0
  ) {
    rows.push({
      tenantId: args.tenantId,
      resourceType: "PATIENT",
      resourceId: args.patientId,
      system: ANANG_FHIR_PATIENT_REF,
      value: args.fhirPatientLogicalId.trim(),
    });
  }
  if (
    args.fhirEncounterLogicalId &&
    args.fhirEncounterLogicalId.trim().length > 0
  ) {
    rows.push({
      tenantId: args.tenantId,
      resourceType: "ENCOUNTER",
      resourceId: args.encounterId,
      system: ANANG_FHIR_ENCOUNTER_REF,
      value: args.fhirEncounterLogicalId.trim(),
    });
  }

  for (const row of rows) {
    await db.externalIdentifier.upsert({
      where: {
        tenantId_resourceType_system_value: {
          tenantId: row.tenantId,
          resourceType: row.resourceType,
          system: row.system,
          value: row.value,
        },
      },
      create: row,
      update: { resourceId: row.resourceId },
    });
  }
}

export async function findPatientIdByFhirPatientLogicalId(
  db: DbClient,
  tenantId: string,
  fhirPatientLogicalId: string | null | undefined,
): Promise<string | null> {
  if (!fhirPatientLogicalId?.trim()) return null;
  const row = await db.externalIdentifier.findFirst({
    where: {
      tenantId,
      resourceType: "PATIENT",
      system: ANANG_FHIR_PATIENT_REF,
      value: fhirPatientLogicalId.trim(),
    },
  });
  return row?.resourceId ?? null;
}

/** Canonical encounter row for this tenant when FHIR Encounter id was seen before. */
export async function findEncounterByFhirEncounterLogicalId(
  db: DbClient,
  tenantId: string,
  fhirEncounterLogicalId: string | null | undefined,
): Promise<{ id: string; patientId: string } | null> {
  if (!fhirEncounterLogicalId?.trim()) return null;
  const ext = await db.externalIdentifier.findFirst({
    where: {
      tenantId,
      resourceType: "ENCOUNTER",
      system: ANANG_FHIR_ENCOUNTER_REF,
      value: fhirEncounterLogicalId.trim(),
    },
  });
  if (!ext) return null;
  const enc = await db.encounter.findFirst({
    where: { id: ext.resourceId, tenantId },
    select: { id: true, patientId: true },
  });
  return enc;
}

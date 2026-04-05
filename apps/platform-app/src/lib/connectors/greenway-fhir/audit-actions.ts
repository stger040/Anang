/** Hub — Implementation form “Sync Patient + Encounters”. */
export const GREENWAY_FHIR_HUB_SYNC_AUDIT_ACTION =
  "integration.greenway_fhir.patient_encounter_sync";

/** Secured cron (single or bulk env list). */
export const GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION =
  "integration.greenway_fhir.cron_patient_encounter_sync";

export const GREENWAY_FHIR_HUB_TEST_AUDIT_ACTION =
  "integration.greenway_fhir.patient_read_test";

/** For `prisma.auditEvent.findMany` `action: { in: … }`. */
export const GREENWAY_FHIR_AUDIT_ACTIONS = [
  GREENWAY_FHIR_HUB_TEST_AUDIT_ACTION,
  GREENWAY_FHIR_HUB_SYNC_AUDIT_ACTION,
  GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION,
] as const;

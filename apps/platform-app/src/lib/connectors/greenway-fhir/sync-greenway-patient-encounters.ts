/**
 * Pilot worker: GET Patient + Encounter?patient=… from Greenway FHIR, upsert
 * canonical Patient / Encounter + IngestionBatch / SourceArtifact (audit).
 */

import type { GreenwayFhirEnvConfig } from "./env";
import {
  greenwayFhirGetFhirHref,
  greenwayFhirGetResource,
  greenwayFhirGetUrl,
} from "./client";
import { normalizeFhirEncounterResource } from "./normalize-fhir-encounter-resource";
import { normalizeFhirPatientResource } from "./normalize-fhir-patient-resource";
import {
  findEncounterByFhirEncounterLogicalId,
  findPatientIdByFhirPatientLogicalId,
  recordFhirFixtureExternalIds,
  recordFhirPatientExternalIdOnly,
} from "@/lib/connectors/external-identifiers";
import { createIngestionBatchRecordingRawPayload } from "@/lib/connectors/source-artifact";
import type { PrismaClient } from "@prisma/client";

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function encounterResourcesFromBundle(searchBody: unknown): unknown[] {
  const rec = asRecord(searchBody);
  if (!rec || rec.resourceType !== "Bundle") return [];
  const entry = rec.entry;
  if (!Array.isArray(entry)) return [];
  const out: unknown[] = [];
  for (const e of entry) {
    const er = asRecord(e);
    const res = er?.resource;
    const rr = asRecord(res);
    if (rr?.resourceType === "Encounter") out.push(res);
  }
  return out;
}

/** FHIR Bundle.link relation "next" — pagination. */
export function extractNextBundleUrl(bundleBody: unknown): string | null {
  const rec = asRecord(bundleBody);
  const links = rec?.link;
  if (!Array.isArray(links)) return null;
  for (const L of links) {
    const lr = asRecord(L);
    if (
      lr?.relation === "next" &&
      typeof lr.url === "string" &&
      lr.url.trim()
    ) {
      return lr.url.trim();
    }
  }
  return null;
}

const MAX_ENCOUNTER_BUNDLE_PAGES = 25;

async function fetchEncounterSearchBundles(
  config: GreenwayFhirEnvConfig,
  pid: string,
): Promise<
  | { ok: true; bundles: unknown[]; warnings: string[] }
  | { ok: false; error: string }
> {
  const searchPath = `Encounter?patient=${encodeURIComponent(`Patient/${pid}`)}&_count=50`;
  const first = await greenwayFhirGetUrl(config, searchPath);
  if (!first.ok) {
    return {
      ok: false,
      error: `Encounter search failed (HTTP ${first.status})`,
    };
  }

  const bundles: unknown[] = [first.body];
  const warnings: string[] = [];
  let cursorBody: unknown = first.body;
  let pages = 1;

  while (pages < MAX_ENCOUNTER_BUNDLE_PAGES) {
    const nextHref = extractNextBundleUrl(cursorBody);
    if (!nextHref) break;
    pages += 1;
    let nextRes;
    try {
      nextRes = await greenwayFhirGetFhirHref(config, nextHref);
    } catch {
      warnings.push(`Encounter search page ${pages}: request error`);
      break;
    }
    if (!nextRes.ok) {
      warnings.push(
        `Encounter search page ${pages} failed (HTTP ${nextRes.status})`,
      );
      break;
    }
    bundles.push(nextRes.body);
    cursorBody = nextRes.body;
  }

  if (extractNextBundleUrl(cursorBody) && pages >= MAX_ENCOUNTER_BUNDLE_PAGES) {
    warnings.push(
      `Encounter search stopped at ${MAX_ENCOUNTER_BUNDLE_PAGES} Bundle pages — more results may exist.`,
    );
  }

  return { ok: true, bundles, warnings };
}

export type SyncGreenwayPatientEncountersResult =
  | {
      ok: true;
      anangPatientId: string;
      encountersUpserted: number;
      encounterAnangIds: string[];
      ingestionBatchId: string;
      warnings: string[];
    }
  | { ok: false; error: string };

export async function syncGreenwayPatientEncounters(
  db: PrismaClient,
  args: {
    tenantId: string;
    config: GreenwayFhirEnvConfig;
    fhirPatientLogicalId: string;
  },
): Promise<SyncGreenwayPatientEncountersResult> {
  const { tenantId, config, fhirPatientLogicalId } = args;
  const pid = fhirPatientLogicalId.trim();
  if (!pid) {
    return { ok: false, error: "fhirPatientLogicalId is required" };
  }
  if (!config.accessToken) {
    return { ok: false, error: "Greenway FHIR access token is not available" };
  }

  const patientRes = await greenwayFhirGetResource(config, "Patient", pid);
  if (!patientRes.ok) {
    return {
      ok: false,
      error: `Patient read failed (HTTP ${patientRes.status})`,
    };
  }

  const patientNorm = normalizeFhirPatientResource(patientRes.body);
  if (!patientNorm.ok) {
    return { ok: false, error: patientNorm.error };
  }
  if (patientNorm.data.fhirLogicalId !== pid) {
    return {
      ok: false,
      error: "Patient.id does not match requested logical id",
    };
  }

  const search = await fetchEncounterSearchBundles(config, pid);
  if (!search.ok) {
    return { ok: false, error: search.error };
  }

  const encBodies = search.bundles.flatMap(encounterResourcesFromBundle);
  const warnings: string[] = [...search.warnings];
  const lastBundle = search.bundles[search.bundles.length - 1];
  const bundleRec = asRecord(lastBundle);
  const total =
    typeof bundleRec?.total === "number" ? bundleRec.total : undefined;
  if (typeof total === "number" && total > encBodies.length) {
    warnings.push(
      `Server reports total ${total} Encounters but only ${encBodies.length} were collected — check skipped pages or unmatched Bundle entries.`,
    );
  }

  const rawText = JSON.stringify({
    patient: patientRes.body,
    encounterSearchBundles: search.bundles,
  });

  return db.$transaction(async (tx) => {
    const ingest = await createIngestionBatchRecordingRawPayload(tx, {
      tenantId,
      connectorKind: "greenway_fhir",
      sourceKind: "greenway_fhir_patient_encounter_sync",
      rawText,
      metadata: {
        greenwayFhirPatientId: pid,
        patientHttpStatus: patientRes.status,
        encounterBundlePageCount: search.bundles.length,
        encounterResourceCount: encBodies.length,
      },
    });

    const d = patientNorm.data;
    const existingPatientId = await findPatientIdByFhirPatientLogicalId(
      tx,
      tenantId,
      d.fhirLogicalId,
    );
    const patient =
      existingPatientId != null
        ? await tx.patient.update({
            where: { id: existingPatientId, tenantId },
            data: {
              mrn: d.mrn,
              firstName: d.firstName,
              lastName: d.lastName,
              dob: d.dob,
            },
          })
        : await tx.patient.create({
            data: {
              tenantId,
              mrn: d.mrn,
              firstName: d.firstName,
              lastName: d.lastName,
              dob: d.dob,
            },
          });

    await recordFhirPatientExternalIdOnly(tx, {
      tenantId,
      patientId: patient.id,
      fhirPatientLogicalId: d.fhirLogicalId,
    });

    const encounterAnangIds: string[] = [];

    for (const body of encBodies) {
      const encNorm = normalizeFhirEncounterResource(body);
      if (!encNorm.ok) {
        warnings.push(encNorm.error);
        continue;
      }
      const e = encNorm.data;
      if (e.patientFhirLogicalId !== pid) {
        warnings.push(
          `Encounter ${e.fhirLogicalId} references Patient/${e.patientFhirLogicalId}, not ${pid} — skipped`,
        );
        continue;
      }

      const existingEncRow = await findEncounterByFhirEncounterLogicalId(
        tx,
        tenantId,
        e.fhirLogicalId,
      );
      if (existingEncRow && existingEncRow.patientId !== patient.id) {
        warnings.push(
          `Encounter ${e.fhirLogicalId} already linked to another patient — skipped`,
        );
        continue;
      }

      const encounter =
        existingEncRow != null
          ? await tx.encounter.update({
              where: { id: existingEncRow.id, tenantId },
              data: {
                patientId: patient.id,
                dateOfService: e.dateOfService,
                chiefComplaint: e.chiefComplaint,
                visitSummary: e.visitSummary,
                reviewStatus: "queued",
              },
            })
          : await tx.encounter.create({
              data: {
                tenantId,
                patientId: patient.id,
                dateOfService: e.dateOfService,
                chiefComplaint: e.chiefComplaint,
                visitSummary: e.visitSummary,
                reviewStatus: "queued",
              },
            });

      await recordFhirFixtureExternalIds(tx, {
        tenantId,
        patientId: patient.id,
        encounterId: encounter.id,
        fhirPatientLogicalId: d.fhirLogicalId,
        fhirEncounterLogicalId: e.fhirLogicalId,
      });

      encounterAnangIds.push(encounter.id);
    }

    return {
      ok: true as const,
      anangPatientId: patient.id,
      encountersUpserted: encounterAnangIds.length,
      encounterAnangIds,
      ingestionBatchId: ingest.batch.id,
      warnings,
    };
  });
}

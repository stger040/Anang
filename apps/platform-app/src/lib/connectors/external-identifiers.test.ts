import { describe, expect, it, vi } from "vitest";

import {
  ANANG_FHIR_ENCOUNTER_REF,
  ANANG_FHIR_PATIENT_REF,
  findEncounterByFhirEncounterLogicalId,
  findPatientIdByFhirPatientLogicalId,
} from "@/lib/connectors/external-identifiers";

describe("findPatientIdByFhirPatientLogicalId", () => {
  it("returns null when id missing", async () => {
    const db = { externalIdentifier: { findFirst: vi.fn() } };
    const r = await findPatientIdByFhirPatientLogicalId(
      db as never,
      "t1",
      null,
    );
    expect(r).toBeNull();
    expect(db.externalIdentifier.findFirst).not.toHaveBeenCalled();
  });

  it("queries tenant-scoped patient ref", async () => {
    const findFirst = vi.fn().mockResolvedValue({ resourceId: "pat-x" });
    const db = { externalIdentifier: { findFirst } };
    const r = await findPatientIdByFhirPatientLogicalId(
      db as never,
      "t1",
      "  abc  ",
    );
    expect(r).toBe("pat-x");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        resourceType: "PATIENT",
        system: ANANG_FHIR_PATIENT_REF,
        value: "abc",
      },
    });
  });
});

describe("findEncounterByFhirEncounterLogicalId", () => {
  it("returns null when ext missing", async () => {
    const db = {
      externalIdentifier: { findFirst: vi.fn().mockResolvedValue(null) },
      encounter: { findFirst: vi.fn() },
    };
    const r = await findEncounterByFhirEncounterLogicalId(
      db as never,
      "t1",
      "e1",
    );
    expect(r).toBeNull();
    expect(db.encounter.findFirst).not.toHaveBeenCalled();
  });

  it("returns encounter when ext and row exist", async () => {
    const db = {
      externalIdentifier: {
        findFirst: vi.fn().mockResolvedValue({ resourceId: "enc-x" }),
      },
      encounter: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "enc-x", patientId: "pat-a" }),
      },
    };
    const r = await findEncounterByFhirEncounterLogicalId(
      db as never,
      "t1",
      "e1",
    );
    expect(r).toEqual({ id: "enc-x", patientId: "pat-a" });
    expect(db.externalIdentifier.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "t1",
        resourceType: "ENCOUNTER",
        system: ANANG_FHIR_ENCOUNTER_REF,
        value: "e1",
      },
    });
    expect(db.encounter.findFirst).toHaveBeenCalledWith({
      where: { id: "enc-x", tenantId: "t1" },
      select: { id: true, patientId: true },
    });
  });
});

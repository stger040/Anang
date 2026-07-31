import { describe, expect, it } from "vitest";

import {
  mergeGreenwayPatientDemographics,
  normalizeFhirPatientResource,
} from "./normalize-fhir-patient-resource";

describe("normalizeFhirPatientResource", () => {
  it("maps a minimal Patient", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "p1",
      name: [{ family: "Doe", given: ["Jane"] }],
      birthDate: "1990-05-01",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        fhirLogicalId: "p1",
        mrn: null,
        firstName: "Jane",
        lastName: "Doe",
        dob: new Date("1990-05-01"),
        nameFromFhir: true,
        mrnFromFhir: false,
        dobFromFhir: true,
      },
    });
  });

  it("prefers MRN identifier", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "x",
      identifier: [
        { system: "urn:foo", value: "OTHER" },
        {
          type: { coding: [{ code: "MR" }] },
          value: "MRN-9",
        },
      ],
      name: [{ text: "A B" }],
    });
    expect(r.ok && r.data.mrn).toBe("MRN-9");
    expect(r.ok && r.data.mrnFromFhir).toBe(true);
    expect(r.ok && r.data.nameFromFhir).toBe(true);
  });

  it("marks sparse Patient demographics as not from FHIR", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "sparse-1",
    });
    expect(r).toEqual({
      ok: true,
      data: {
        fhirLogicalId: "sparse-1",
        mrn: null,
        firstName: "Unknown",
        lastName: "Patient",
        dob: null,
        nameFromFhir: false,
        mrnFromFhir: false,
        dobFromFhir: false,
      },
    });
  });

  it("does not treat empty name entries as FHIR-supplied", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "empty-name",
      name: [{ given: [], family: "" }],
    });
    expect(r.ok && r.data.nameFromFhir).toBe(false);
    expect(r.ok && r.data.firstName).toBe("Unknown");
  });

  it("rejects invalid birthDate without claiming dobFromFhir", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "bad-dob",
      birthDate: "not-a-date",
      name: [{ family: "X", given: ["Y"] }],
    });
    expect(r.ok && r.data.dob).toBeNull();
    expect(r.ok && r.data.dobFromFhir).toBe(false);
  });

  it("rejects non-Patient", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Observation",
      id: "o1",
    });
    expect(r.ok).toBe(false);
  });
});

describe("mergeGreenwayPatientDemographics", () => {
  const existing = {
    mrn: "MRN-100",
    firstName: "Ada",
    lastName: "Lovelace",
    dob: new Date("1815-12-10"),
  };

  it("preserves existing fields when FHIR payload is sparse", () => {
    const sparse = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "gw-1",
    });
    expect(sparse.ok).toBe(true);
    if (!sparse.ok) return;
    expect(mergeGreenwayPatientDemographics(existing, sparse.data)).toEqual(
      existing,
    );
  });

  it("applies only fields that FHIR actually supplied", () => {
    const partial = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "gw-2",
      name: [{ family: "Byron", given: ["Augusta"] }],
    });
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(mergeGreenwayPatientDemographics(existing, partial.data)).toEqual({
      mrn: "MRN-100",
      firstName: "Augusta",
      lastName: "Byron",
      dob: existing.dob,
    });
  });

  it("updates MRN and DOB when FHIR supplies them", () => {
    const full = normalizeFhirPatientResource({
      resourceType: "Patient",
      id: "gw-3",
      identifier: [{ type: { coding: [{ code: "MR" }] }, value: "MRN-200" }],
      name: [{ family: "Lovelace", given: ["Ada"] }],
      birthDate: "1815-12-10",
    });
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    expect(mergeGreenwayPatientDemographics(existing, full.data)).toEqual({
      mrn: "MRN-200",
      firstName: "Ada",
      lastName: "Lovelace",
      dob: new Date("1815-12-10"),
    });
  });
});

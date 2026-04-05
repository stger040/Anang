import { describe, expect, it } from "vitest";

import { normalizeFhirPatientResource } from "./normalize-fhir-patient-resource";

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
  });

  it("rejects non-Patient", () => {
    const r = normalizeFhirPatientResource({
      resourceType: "Observation",
      id: "o1",
    });
    expect(r.ok).toBe(false);
  });
});

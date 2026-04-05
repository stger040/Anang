import { describe, expect, it } from "vitest";

import { normalizeFhirEncounterResource } from "./normalize-fhir-encounter-resource";

describe("normalizeFhirEncounterResource", () => {
  it("maps Encounter with period and subject", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e1",
      status: "finished",
      subject: { reference: "Patient/p1" },
      period: { start: "2024-01-15T10:00:00Z" },
      type: [
        {
          coding: [{ display: "Office Visit" }],
        },
      ],
    });
    expect(r).toEqual({
      ok: true,
      data: {
        fhirLogicalId: "e1",
        patientFhirLogicalId: "p1",
        dateOfService: new Date("2024-01-15T10:00:00Z"),
        chiefComplaint: null,
        visitSummary: "Office Visit",
      },
    });
  });

  it("parses full URL subject reference", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e2",
      subject: {
        reference: "https://fhir.example/fhir/R4/t/Patient/abc",
      },
      period: { start: "2024-06-01" },
    });
    expect(r.ok && r.data.patientFhirLogicalId).toBe("abc");
  });

  it("rejects missing period.start", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e3",
      subject: { reference: "Patient/p1" },
    });
    expect(r.ok).toBe(false);
  });
});

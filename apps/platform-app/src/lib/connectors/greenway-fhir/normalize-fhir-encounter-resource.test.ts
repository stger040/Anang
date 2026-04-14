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
        placeOfService: null,
        visitType: "Office Visit",
      },
    });
  });

  it("maps placeOfService from two-digit POS code in Encounter.type", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e-pos",
      subject: { reference: "Patient/p1" },
      period: { start: "2024-01-15T10:00:00Z" },
      type: [
        {
          coding: [
            {
              system: "https://www.cms.gov/Medicare/Coding/place-of-service-codes",
              code: "11",
              display: "Office",
            },
          ],
        },
      ],
    });
    expect(r.ok && r.data.placeOfService).toBe("11");
    expect(r.ok && r.data.visitType).toBe("Office");
  });

  it("maps placeOfService from v3 ActCode IMP to CMS 21", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e-imp",
      subject: { reference: "Patient/p1" },
      period: { start: "2024-01-15T10:00:00Z" },
      class: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: "IMP",
            display: "inpatient encounter",
          },
        ],
      },
    });
    expect(r.ok && r.data.placeOfService).toBe("21");
    expect(r.ok && r.data.visitType).toBe("inpatient encounter");
  });

  it("prefers visitType from Encounter.class over type", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e-cls",
      subject: { reference: "Patient/p1" },
      period: { start: "2024-01-15T10:00:00Z" },
      class: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: "AMB",
            display: "ambulatory",
          },
        ],
      },
      type: [{ text: "Follow-up" }],
    });
    expect(r.ok && r.data.visitType).toBe("ambulatory");
  });

  it("uses location Reference.display as placeOfService fallback when no POS code", () => {
    const r = normalizeFhirEncounterResource({
      resourceType: "Encounter",
      id: "e-loc",
      subject: { reference: "Patient/p1" },
      period: { start: "2024-01-15T10:00:00Z" },
      location: [
        {
          location: { display: "Main Street Clinic" },
        },
      ],
    });
    expect(r.ok && r.data.placeOfService).toBe("Main Street Clinic");
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

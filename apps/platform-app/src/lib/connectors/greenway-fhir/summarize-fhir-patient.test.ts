import { describe, expect, it } from "vitest";

import { summarizeFhirPatientResource } from "./summarize-fhir-patient";

describe("summarizeFhirPatientResource", () => {
  it("summarizes a minimal Patient", () => {
    const r = summarizeFhirPatientResource({
      resourceType: "Patient",
      id: "p1",
      name: [{ family: "Doe", given: ["Jane"] }],
      gender: "female",
      birthDate: "1990-01-02",
    });
    expect(r).toEqual({
      ok: true,
      summary: {
        resourceType: "Patient",
        logicalId: "p1",
        nameLine: "Jane Doe",
        birthDate: "1990-01-02",
        gender: "female",
      },
    });
  });

  it("prefers name.text", () => {
    const r = summarizeFhirPatientResource({
      resourceType: "Patient",
      id: "x",
      name: [{ text: "Public, John Q" }],
    });
    expect(r.ok && r.summary.nameLine).toBe("Public, John Q");
  });

  it("handles OperationOutcome", () => {
    const r = summarizeFhirPatientResource({
      resourceType: "OperationOutcome",
      issue: [{ diagnostics: "Not found" }],
    });
    expect(r).toEqual({ ok: false, message: "Not found" });
  });

  it("rejects wrong type", () => {
    const r = summarizeFhirPatientResource({
      resourceType: "Observation",
      id: "o1",
    });
    expect(r.ok).toBe(false);
  });
});

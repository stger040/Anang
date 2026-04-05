import { describe, expect, it } from "vitest";
import { parseFhirVisitSummaryMeta } from "./fhir-visit-summary-meta";

describe("parseFhirVisitSummaryMeta", () => {
  it("detects fixture import without EOB", () => {
    const text =
      "Imported from FHIR R4 fixture (pilot test). EHR Encounter id: e1.";
    expect(parseFhirVisitSummaryMeta(text)).toEqual({
      isFhirFixtureImport: true,
      explanationOfBenefitResourceCount: null,
    });
  });

  it("parses EOB resource count from visitSummary tail", () => {
    const text =
      "Imported from FHIR R4 fixture (pilot test). R4 ExplanationOfBenefit: 3 resource(s).";
    expect(parseFhirVisitSummaryMeta(text)).toEqual({
      isFhirFixtureImport: true,
      explanationOfBenefitResourceCount: 3,
    });
  });

  it("returns false for seed / non-FHIR summaries", () => {
    expect(
      parseFhirVisitSummaryMeta("Routine follow-up; seed data."),
    ).toEqual({
      isFhirFixtureImport: false,
      explanationOfBenefitResourceCount: null,
    });
  });
});

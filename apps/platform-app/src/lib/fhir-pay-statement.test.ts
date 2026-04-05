import { describe, expect, it } from "vitest";
import { isFhirFixtureImportStatementNumber } from "./fhir-pay-statement";

describe("isFhirFixtureImportStatementNumber", () => {
  it("is true for import-assigned prefixes", () => {
    expect(isFhirFixtureImportStatementNumber("FHIR-SBX-A1B2C3D4")).toBe(true);
    expect(isFhirFixtureImportStatementNumber("FHIR-CLM-ABC123")).toBe(true);
    expect(isFhirFixtureImportStatementNumber("fhir-clm-multi-xyz")).toBe(true);
    expect(isFhirFixtureImportStatementNumber("CSV-INV-MAR-001")).toBe(true);
  });

  it("is false for seed and typical production-style numbers", () => {
    expect(isFhirFixtureImportStatementNumber("STMT-LCO-12001")).toBe(false);
    expect(isFhirFixtureImportStatementNumber("INV-2024-001")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { planPatientEncounterStatementImport } from "./patient-encounter-statement-plan";

describe("planPatientEncounterStatementImport", () => {
  it("creates the base statement when none exist", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [],
      }),
    ).toEqual({ action: "create", number: "FHIR-CLM-ABC" });
  });

  it("replaces an unpaid base statement", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [{ id: "s1", number: "FHIR-CLM-ABC", paymentCount: 0 }],
      }),
    ).toEqual({
      action: "replace",
      statementId: "s1",
      number: "FHIR-CLM-ABC",
    });
  });

  it("creates a single -P companion when the only statement is paid", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [{ id: "s1", number: "FHIR-CLM-ABC", paymentCount: 1 }],
      }),
    ).toEqual({ action: "create", number: "FHIR-CLM-ABC-P" });
  });

  it("replaces an unpaid -P instead of creating another when findFirst would see the paid base", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [
          { id: "s1", number: "FHIR-CLM-ABC", paymentCount: 2 },
          { id: "s2", number: "FHIR-CLM-ABC-P", paymentCount: 0 },
        ],
      }),
    ).toEqual({
      action: "replace",
      statementId: "s2",
      number: "FHIR-CLM-ABC-P",
    });
  });

  it("reuses a paid -P on further re-imports (no unbounded A/R)", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [
          { id: "s1", number: "FHIR-CLM-ABC", paymentCount: 1 },
          { id: "s2", number: "FHIR-CLM-ABC-P", paymentCount: 1 },
        ],
      }),
    ).toEqual({ action: "reuse_paid", statementId: "s2" });
  });

  it("prefers the stable unpaid row when multiple unpaid exist", () => {
    expect(
      planPatientEncounterStatementImport({
        stmtNumber: "FHIR-CLM-ABC",
        existing: [
          { id: "s9", number: "FHIR-CLM-ABC-P", paymentCount: 0 },
          { id: "s2", number: "FHIR-CLM-ABC", paymentCount: 0 },
        ],
      }),
    ).toEqual({
      action: "replace",
      statementId: "s2",
      number: "FHIR-CLM-ABC",
    });
  });
});

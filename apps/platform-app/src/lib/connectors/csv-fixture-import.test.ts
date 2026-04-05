import { describe, expect, it } from "vitest";

import {
  normalizeCsvEncounterStatementUpload,
  parseCsvRows,
} from "@/lib/connectors/csv-fixture-import";

describe("parseCsvRows", () => {
  it("parses quoted commas", () => {
    const rows = parseCsvRows(`a,b\n"hello, world",2`);
    expect(rows).toEqual([
      ["a", "b"],
      ["hello, world", "2"],
    ]);
  });
});

describe("normalizeCsvEncounterStatementUpload", () => {
  it("accepts valid single row", () => {
    const csv = `patient_mrn,patient_first_name,patient_last_name,patient_dob,encounter_dos,statement_number,line_code,line_description,line_amount_cents
X,Ann,Smith,1991-02-03,2026-01-10,S1,99213,Visit,12000`;
    const r = normalizeCsvEncounterStatementUpload(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.normalized.firstName).toBe("Ann");
    expect(r.normalized.claimStatement?.lines).toHaveLength(1);
    expect(r.normalized.claimStatement?.lines[0]?.amountCents).toBe(12000);
    expect(r.payStatementNumber.startsWith("CSV-")).toBe(true);
  });

  it("rejects mismatched encounter_dos", () => {
    const csv = `patient_mrn,patient_first_name,patient_last_name,patient_dob,encounter_dos,statement_number,line_code,line_description,line_amount_cents
X,Ann,Smith,1991-02-03,2026-01-10,S1,99213,Visit,12000
X,Ann,Smith,1991-02-03,2026-01-11,S1,99214,Visit2,12000`;
    const r = normalizeCsvEncounterStatementUpload(csv);
    expect(r.ok).toBe(false);
  });
});

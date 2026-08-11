import { describe, expect, it } from "vitest";

import {
  normalizeCsvEncounterStatementUpload,
  parseCsvRows,
  slugSegment,
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

  it("keeps distinct MRNs that differ only by separator punctuation", () => {
    const header =
      "patient_mrn,patient_first_name,patient_last_name,patient_dob,encounter_dos,statement_number,line_code,line_description,line_amount_cents";
    const a = normalizeCsvEncounterStatementUpload(
      `${header}\nMRN-001,Ann,Smith,1991-02-03,2026-01-10,S1,99213,Visit,12000`,
    );
    const b = normalizeCsvEncounterStatementUpload(
      `${header}\nMRN_001,Bob,Jones,1990-01-01,2026-01-11,S2,99214,Visit,15000`,
    );
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.normalized.fhirPatientLogicalId).not.toBe(
      b.normalized.fhirPatientLogicalId,
    );
    expect(a.normalized.fhirPatientLogicalId).toBe("csv:patient:mrn%2d001");
    expect(b.normalized.fhirPatientLogicalId).toBe("csv:patient:mrn%5f001");
    expect(a.normalized.fhirEncounterLogicalId).not.toBe(
      b.normalized.fhirEncounterLogicalId,
    );
  });
});

describe("slugSegment", () => {
  it("does not collapse hyphen and underscore into the same slug", () => {
    expect(slugSegment("MRN-001")).toBe("mrn%2d001");
    expect(slugSegment("MRN_001")).toBe("mrn%5f001");
    expect(slugSegment("MRN-001")).not.toBe(slugSegment("MRN_001"));
  });

  it("preserves alphanumeric-only ids for re-import idempotency", () => {
    expect(slugSegment("ABC123")).toBe("abc123");
  });
});

/**
 * Pilot CSV → same canonical shape as FHIR fixture import (Patient, Encounter, Statement lines).
 * One encounter per file; one row per statement line. See Implementation hub template.
 */

import type { NormalizedFhirPatientEncounter } from "@/lib/fhir-fixture-import";

export const CSV_ENCOUNTER_STATEMENT_V1_COLUMNS = [
  "patient_mrn",
  "patient_first_name",
  "patient_last_name",
  "patient_dob",
  "encounter_dos",
  "statement_number",
  "line_code",
  "line_description",
  "line_amount_cents",
] as const;

const MAX_BYTES = 512_000;
const MAX_LINES = 60;

export type CsvFixtureImportResult =
  | { ok: false; error: string }
  | {
      ok: true;
      normalized: NormalizedFhirPatientEncounter;
      payStatementNumber: string;
      rowCount: number;
    };

/** Minimal RFC 4180: double-quoted fields escape quotes as "". */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i]!;

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ",") {
      row.push(cur);
      cur = "";
      i += 1;
      continue;
    }
    if (c === "\r") {
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cur += c;
    i += 1;
  }
  row.push(cur);
  if (row.some((cell) => cell.length > 0)) rows.push(row);

  return rows;
}

function slugSegment(s: string): string {
  const t = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return t.slice(0, 48) || "x";
}

function parseDos(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T12:00:00Z` : t;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDob(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  return parseDos(t);
}

export function normalizeCsvEncounterStatementUpload(
  text: string,
): CsvFixtureImportResult {
  const buf = Buffer.byteLength(text, "utf8");
  if (buf > MAX_BYTES) {
    return { ok: false, error: `CSV exceeds maximum size (${MAX_BYTES} bytes).` };
  }

  const rows = parseCsvRows(text.trim());
  if (rows.length < 2) {
    return { ok: false, error: "CSV must include a header row and at least one data row." };
  }

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const expected = [...CSV_ENCOUNTER_STATEMENT_V1_COLUMNS];
  if (header.length < expected.length) {
    return {
      ok: false,
      error: `Header missing columns. Expected: ${expected.join(", ")}`,
    };
  }
  for (let c = 0; c < expected.length; c++) {
    if (header[c] !== expected[c]) {
      return {
        ok: false,
        error: `Column ${c + 1} must be "${expected[c]}" (found "${header[c] ?? ""}").`,
      };
    }
  }

  const dataRows = rows.slice(1).filter((r) => r.some((x) => x.trim() !== ""));
  if (dataRows.length === 0) {
    return { ok: false, error: "No data rows after header." };
  }
  if (dataRows.length > MAX_LINES) {
    return { ok: false, error: `At most ${MAX_LINES} data rows allowed.` };
  }

  const first = dataRows[0]!;
  const patientMrn = first[0]!.trim();
  const patientFirst = first[1]!.trim();
  const patientLast = first[2]!.trim();
  const patientDobRaw = first[3]!.trim();
  const encounterDosRaw = first[4]!.trim();
  const statementNumberRaw = first[5]!.trim();

  if (!patientFirst || !patientLast) {
    return { ok: false, error: "patient_first_name and patient_last_name are required." };
  }
  if (!encounterDosRaw) {
    return { ok: false, error: "encounter_dos is required (use YYYY-MM-DD)."};
  }
  const dos = parseDos(encounterDosRaw);
  if (!dos) {
    return { ok: false, error: "encounter_dos must be a valid date (YYYY-MM-DD recommended)." };
  }
  if (!statementNumberRaw) {
    return { ok: false, error: "statement_number is required." };
  }

  const lines: Array<{ code: string; description: string; amountCents: number }> = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r]!;
    const mrn = row[0]!.trim();
    const fn = row[1]!.trim();
    const ln = row[2]!.trim();
    const dobR = row[3]!.trim();
    const dosR = row[4]!.trim();
    const stmtR = row[5]!.trim();
    const code = row[6]!.trim();
    const desc = row[7]!.trim();
    const amtRaw = row[8]!.trim();

    if (mrn !== patientMrn || fn !== patientFirst || ln !== patientLast) {
      return {
        ok: false,
        error: `Row ${r + 2}: patient columns must match the first data row.`,
      };
    }
    if (dobR !== patientDobRaw) {
      return {
        ok: false,
        error: `Row ${r + 2}: patient_dob must match across all rows.`,
      };
    }
    const dosCheck = parseDos(dosR);
    if (!dosCheck || dosCheck.getTime() !== dos.getTime()) {
      return {
        ok: false,
        error: `Row ${r + 2}: encounter_dos must match across all rows.`,
      };
    }
    if (stmtR !== statementNumberRaw) {
      return {
        ok: false,
        error: `Row ${r + 2}: statement_number must match across all rows.`,
      };
    }
    if (!code) {
      return { ok: false, error: `Row ${r + 2}: line_code is required.` };
    }
    const amountCents = Number(amtRaw);
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      return {
        ok: false,
        error: `Row ${r + 2}: line_amount_cents must be a non-negative integer.`,
      };
    }

    lines.push({ code, description: desc || code, amountCents });
  }

  const dob = patientDobRaw ? parseDob(patientDobRaw) : null;
  if (patientDobRaw && !dob) {
    return { ok: false, error: "patient_dob could not be parsed (use YYYY-MM-DD)." };
  }

  const payStmt =
    `CSV-${statementNumberRaw.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32) || "STMT"}`.toUpperCase();

  const pSlug = slugSegment(patientMrn || `${patientFirst}-${patientLast}`);
  const dosKey = dos.toISOString().slice(0, 10);
  const sSlug = slugSegment(statementNumberRaw);

  const normalized: NormalizedFhirPatientEncounter = {
    mrn: patientMrn || null,
    firstName: patientFirst,
    lastName: patientLast,
    dob,
    dateOfService: dos,
    chiefComplaint: null,
    visitSummary: `CSV import (${lines.length} line(s)). Operational import — not clinical documentation.`,
    claimStatement: {
      lines,
      claimLogicalId: null,
      claimIds: [],
      claimResourceCount: 0,
    },
    fhirPatientLogicalId: `csv:patient:${pSlug}`,
    fhirEncounterLogicalId: `csv:enc:${pSlug}:${dosKey}:${sSlug}`,
    explanationOfBenefit: undefined,
  };

  return {
    ok: true,
    normalized,
    payStatementNumber: payStmt,
    rowCount: lines.length,
  };
}

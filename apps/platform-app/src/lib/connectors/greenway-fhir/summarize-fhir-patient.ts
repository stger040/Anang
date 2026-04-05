/**
 * Small, UI-safe projection of a FHIR R4 Patient for pilot connectivity checks.
 * Avoid echoing full telecom/address arrays in logs or compact surfaces.
 */

export type FhirPatientSummary = {
  resourceType: "Patient";
  logicalId: string;
  nameLine: string | null;
  birthDate: string | null;
  gender: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function humanNameLine(names: unknown): string | null {
  if (!Array.isArray(names) || names.length === 0) {
    return null;
  }
  const first = names[0];
  if (!isRecord(first)) {
    return null;
  }
  const text = first.text;
  if (typeof text === "string" && text.trim()) {
    return text.trim();
  }
  const family = first.family;
  const given = first.given;
  const fam = typeof family === "string" ? family.trim() : "";
  const gv = Array.isArray(given)
    ? given.filter((g): g is string => typeof g === "string").join(" ")
    : "";
  const parts = [gv, fam].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function operationOutcomeMessage(body: unknown): string | null {
  if (!isRecord(body) || body.resourceType !== "OperationOutcome") {
    return null;
  }
  const issue = body.issue;
  if (!Array.isArray(issue) || issue.length === 0) {
    return "OperationOutcome with no issues";
  }
  const first = issue[0];
  if (!isRecord(first)) {
    return "OperationOutcome";
  }
  const diag = first.diagnostics;
  if (typeof diag === "string" && diag.trim()) {
    return diag.trim();
  }
  const details = first.details;
  if (isRecord(details)) {
    const t = details.text;
    if (typeof t === "string" && t.trim()) {
      return t.trim();
    }
  }
  return "OperationOutcome";
}

export function summarizeFhirPatientResource(
  body: unknown,
): { ok: true; summary: FhirPatientSummary } | { ok: false; message: string } {
  const oo = operationOutcomeMessage(body);
  if (oo) {
    return { ok: false, message: oo };
  }
  if (!isRecord(body) || body.resourceType !== "Patient") {
    return {
      ok: false,
      message:
        body && isRecord(body) && typeof body.resourceType === "string"
          ? `Expected Patient, got ${body.resourceType}`
          : "Response is not a FHIR Patient resource",
    };
  }
  const id = body.id;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, message: "Patient.id missing" };
  }
  return {
    ok: true,
    summary: {
      resourceType: "Patient",
      logicalId: id.trim(),
      nameLine: humanNameLine(body.name),
      birthDate:
        typeof body.birthDate === "string" ? body.birthDate.trim() || null : null,
      gender:
        typeof body.gender === "string" ? body.gender.trim() || null : null,
    },
  };
}

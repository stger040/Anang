/**
 * Map a standalone FHIR R4 Patient resource (e.g. Greenway GET /Patient/{id})
 * into Anang persistence fields + logical id for ExternalIdentifier.
 */

export type MappedFhirPatientFields = {
  fhirLogicalId: string;
  mrn: string | null;
  firstName: string;
  lastName: string;
  dob: Date | null;
};

export type NormalizeFhirPatientResult =
  | { ok: true; data: MappedFhirPatientFields }
  | { ok: false; error: string };

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function patientName(p: Record<string, unknown>): { first: string; last: string } {
  const names = p.name;
  if (Array.isArray(names) && names.length > 0) {
    const n = asRecord(names[0]);
    if (n?.text && typeof n.text === "string" && n.text.trim()) {
      const parts = n.text.trim().split(/\s+/);
      return {
        first: parts[0] ?? "Unknown",
        last: parts.slice(1).join(" ") || "Patient",
      };
    }
    const given = Array.isArray(n?.given) ? String(n.given[0] ?? "").trim() : "";
    const family =
      typeof n?.family === "string" ? n.family.trim() : "";
    return {
      first: given || "Unknown",
      last: family || "Patient",
    };
  }
  return { first: "Unknown", last: "Patient" };
}

function pickMrn(p: Record<string, unknown>): string | null {
  const ids = p.identifier;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  for (const raw of ids) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const val = rec.value;
    if (typeof val !== "string" || !val.trim()) continue;
    const use = val.trim();
    const type = asRecord(rec.type);
    const coding = type?.coding;
    if (Array.isArray(coding)) {
      const c0 = asRecord(coding[0]);
      const code = c0?.code;
      if (code === "MR" || code === "MRN") return use;
    }
  }
  const first = asRecord(ids[0]);
  const v = first?.value;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function normalizeFhirPatientResource(
  body: unknown,
): NormalizeFhirPatientResult {
  const rec = asRecord(body);
  if (!rec || rec.resourceType !== "Patient") {
    return {
      ok: false,
      error:
        rec && typeof rec.resourceType === "string"
          ? `Expected Patient, got ${rec.resourceType}`
          : "Not a FHIR Patient resource",
    };
  }
  const idRaw = rec.id;
  if (typeof idRaw !== "string" || !idRaw.trim()) {
    return { ok: false, error: "Patient.id is missing" };
  }
  const fhirLogicalId = idRaw.trim();
  const { first, last } = patientName(rec);
  let dob: Date | null = null;
  const bd = rec.birthDate;
  if (typeof bd === "string" && bd.trim()) {
    const d = new Date(bd.trim());
    dob = Number.isNaN(d.getTime()) ? null : d;
  }
  return {
    ok: true,
    data: {
      fhirLogicalId,
      mrn: pickMrn(rec),
      firstName: first,
      lastName: last,
      dob,
    },
  };
}

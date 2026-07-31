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
  /** True when FHIR supplied a usable human name (not a synthetic fallback). */
  nameFromFhir: boolean;
  /** True when FHIR supplied at least one usable identifier value. */
  mrnFromFhir: boolean;
  /** True when FHIR supplied a parseable birthDate. */
  dobFromFhir: boolean;
};

export type NormalizeFhirPatientResult =
  | { ok: true; data: MappedFhirPatientFields }
  | { ok: false; error: string };

export type ExistingPatientDemographics = {
  mrn: string | null;
  firstName: string;
  lastName: string;
  dob: Date | null;
};

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function patientName(p: Record<string, unknown>): {
  first: string;
  last: string;
  fromFhir: boolean;
} {
  const names = p.name;
  if (Array.isArray(names) && names.length > 0) {
    const n = asRecord(names[0]);
    if (n?.text && typeof n.text === "string" && n.text.trim()) {
      const parts = n.text.trim().split(/\s+/);
      return {
        first: parts[0] ?? "Unknown",
        last: parts.slice(1).join(" ") || "Patient",
        fromFhir: true,
      };
    }
    const given = Array.isArray(n?.given) ? String(n.given[0] ?? "").trim() : "";
    const family =
      typeof n?.family === "string" ? n.family.trim() : "";
    if (given || family) {
      return {
        first: given || "Unknown",
        last: family || "Patient",
        fromFhir: true,
      };
    }
  }
  return { first: "Unknown", last: "Patient", fromFhir: false };
}

function pickMrn(p: Record<string, unknown>): {
  mrn: string | null;
  fromFhir: boolean;
} {
  const ids = p.identifier;
  if (!Array.isArray(ids) || ids.length === 0) {
    return { mrn: null, fromFhir: false };
  }
  let firstUsable: string | null = null;
  for (const raw of ids) {
    const rec = asRecord(raw);
    if (!rec) continue;
    const val = rec.value;
    if (typeof val !== "string" || !val.trim()) continue;
    const use = val.trim();
    if (!firstUsable) firstUsable = use;
    const type = asRecord(rec.type);
    const coding = type?.coding;
    if (Array.isArray(coding)) {
      const c0 = asRecord(coding[0]);
      const code = c0?.code;
      if (code === "MR" || code === "MRN") {
        return { mrn: use, fromFhir: true };
      }
    }
  }
  if (firstUsable) {
    return { mrn: firstUsable, fromFhir: true };
  }
  return { mrn: null, fromFhir: false };
}

/**
 * When re-syncing an existing patient, keep prior demographics if the FHIR
 * Patient payload omitted name / identifier / birthDate (or only yielded
 * synthetic fallbacks). Sparse GET responses must not wipe canonical rows.
 */
export function mergeGreenwayPatientDemographics(
  existing: ExistingPatientDemographics,
  incoming: MappedFhirPatientFields,
): ExistingPatientDemographics {
  return {
    mrn: incoming.mrnFromFhir ? incoming.mrn : existing.mrn,
    firstName: incoming.nameFromFhir ? incoming.firstName : existing.firstName,
    lastName: incoming.nameFromFhir ? incoming.lastName : existing.lastName,
    dob: incoming.dobFromFhir ? incoming.dob : existing.dob,
  };
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
  const { first, last, fromFhir: nameFromFhir } = patientName(rec);
  const { mrn, fromFhir: mrnFromFhir } = pickMrn(rec);
  let dob: Date | null = null;
  let dobFromFhir = false;
  const bd = rec.birthDate;
  if (typeof bd === "string" && bd.trim()) {
    const d = new Date(bd.trim());
    if (!Number.isNaN(d.getTime())) {
      dob = d;
      dobFromFhir = true;
    }
  }
  return {
    ok: true,
    data: {
      fhirLogicalId,
      mrn,
      firstName: first,
      lastName: last,
      dob,
      nameFromFhir,
      mrnFromFhir,
      dobFromFhir,
    },
  };
}

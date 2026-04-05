/**
 * Map a standalone FHIR R4 Encounter resource into Anang Encounter fields.
 */

export type MappedFhirEncounterFields = {
  fhirLogicalId: string;
  patientFhirLogicalId: string;
  dateOfService: Date;
  chiefComplaint: string | null;
  visitSummary: string;
};

export type NormalizeFhirEncounterResult =
  | { ok: true; data: MappedFhirEncounterFields }
  | { ok: false; error: string };

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function stripNarrativeDiv(div: unknown): string {
  if (typeof div !== "string") return "";
  return div.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parsePatientLogicalIdFromReference(ref: string): string | null {
  const r = ref.trim();
  if (r.startsWith("Patient/")) {
    const rest = r.slice("Patient/".length);
    return rest.split("/")[0]?.split("?")[0]?.trim() || null;
  }
  const m = /Patient\/([^/?]+)/.exec(r);
  return m?.[1]?.trim() || null;
}

function subjectPatientId(enc: Record<string, unknown>): string | null {
  const subject = asRecord(enc.subject);
  if (!subject) return null;
  return parsePatientLogicalIdFromReference(
    typeof subject.reference === "string" ? subject.reference : "",
  );
}

function pickDateOfService(enc: Record<string, unknown>): Date | null {
  const period = asRecord(enc.period);
  const start = period?.start;
  if (typeof start === "string" && start.trim()) {
    const d = new Date(start.trim());
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pickChiefComplaint(enc: Record<string, unknown>): string | null {
  const reasons = enc.reasonCode;
  if (!Array.isArray(reasons) || reasons.length === 0) return null;
  const r0 = asRecord(reasons[0]);
  if (!r0) return null;
  const text = r0.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  const coding = r0.coding;
  if (Array.isArray(coding) && coding.length > 0) {
    const c = asRecord(coding[0]);
    const disp = c?.display;
    if (typeof disp === "string" && disp.trim()) return disp.trim();
    const code = c?.code;
    if (typeof code === "string" && code.trim()) return code.trim();
  }
  return null;
}

function pickVisitSummary(enc: Record<string, unknown>, logicalId: string): string {
  const text = asRecord(enc.text);
  const div = text?.div;
  const stripped = stripNarrativeDiv(div);
  if (stripped) return stripped;

  const types = enc.type;
  if (Array.isArray(types) && types.length > 0) {
    const t0 = asRecord(types[0]);
    const ttext = t0?.text;
    if (typeof ttext === "string" && ttext.trim()) return ttext.trim();
    const coding = t0?.coding;
    if (Array.isArray(coding) && coding.length > 0) {
      const c = asRecord(coding[0]);
      const disp = c?.display;
      if (typeof disp === "string" && disp.trim()) return disp.trim();
    }
  }

  const cls = enc.class;
  const crec = asRecord(cls);
  const display = crec?.display;
  if (typeof display === "string" && display.trim()) {
    return display.trim();
  }

  return `FHIR Encounter ${logicalId}`;
}

export function normalizeFhirEncounterResource(
  body: unknown,
): NormalizeFhirEncounterResult {
  const rec = asRecord(body);
  if (!rec || rec.resourceType !== "Encounter") {
    return {
      ok: false,
      error:
        rec && typeof rec.resourceType === "string"
          ? `Expected Encounter, got ${rec.resourceType}`
          : "Not a FHIR Encounter resource",
    };
  }
  const idRaw = rec.id;
  if (typeof idRaw !== "string" || !idRaw.trim()) {
    return { ok: false, error: "Encounter.id is missing" };
  }
  const fhirLogicalId = idRaw.trim();
  const patientFhirLogicalId = subjectPatientId(rec);
  if (!patientFhirLogicalId) {
    return { ok: false, error: "Encounter.subject.reference missing or invalid" };
  }
  const dateOfService = pickDateOfService(rec);
  if (!dateOfService) {
    return {
      ok: false,
      error: "Encounter.period.start missing or not parseable",
    };
  }
  return {
    ok: true,
    data: {
      fhirLogicalId,
      patientFhirLogicalId,
      dateOfService,
      chiefComplaint: pickChiefComplaint(rec),
      visitSummary: pickVisitSummary(rec, fhirLogicalId),
    },
  };
}

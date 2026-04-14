/**
 * Map a standalone FHIR R4 Encounter resource into Anang Encounter fields.
 */

export type MappedFhirEncounterFields = {
  fhirLogicalId: string;
  patientFhirLogicalId: string;
  dateOfService: Date;
  chiefComplaint: string | null;
  visitSummary: string;
  /** CMS-style POS (e.g. "11") or descriptive fallback for fee / AI context — conservative extraction. */
  placeOfService: string | null;
  /** Short visit class / type label from Encounter.class or Encounter.type. */
  visitType: string | null;
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

const MAX_LABEL_LEN = 200;

function truncateLabel(s: string, max = MAX_LABEL_LEN): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** High-confidence v3-ActCode → CMS POS (subset only; omit ambiguous codes like AMB). */
const ACT_CLASS_CODE_TO_CMS_POS: Record<string, string> = {
  IMP: "21",
  ACU: "21",
  EMER: "23",
  VR: "02",
  HH: "12",
};

/**
 * Two-digit code or POS-flavored coding system → CMS-like POS string.
 */
function cmsLikePosFromCoding(c: Record<string, unknown>): string | null {
  const codeRaw = typeof c.code === "string" ? c.code.trim() : "";
  if (!codeRaw) return null;
  const sys = typeof c.system === "string" ? c.system.toLowerCase() : "";
  const posSystem =
    sys.includes("placeofservice") ||
    sys.includes("place-of-service") ||
    sys.includes("cms.gov") ||
    sys.includes("medicare.gov");
  if (/^\d{2}$/.test(codeRaw)) return codeRaw;
  if (posSystem && /^\d{1,2}$/.test(codeRaw)) {
    const n = Number.parseInt(codeRaw, 10);
    if (n >= 1 && n <= 99) return codeRaw.padStart(2, "0");
  }
  return null;
}

function scanServiceTypeAndTypeForCmsPos(
  enc: Record<string, unknown>,
): string | null {
  const buckets: unknown[] = [];
  if (enc.serviceType) buckets.push(enc.serviceType);
  if (Array.isArray(enc.type)) {
    for (const t of enc.type) buckets.push(t);
  }
  for (const cc of buckets) {
    const r = asRecord(cc);
    if (!r) continue;
    const codings = r.coding;
    if (!Array.isArray(codings)) continue;
    for (const raw of codings) {
      const c = asRecord(raw);
      if (!c) continue;
      const hit = cmsLikePosFromCoding(c);
      if (hit) return hit;
    }
  }
  return null;
}

function pickClassPrimaryCoding(
  enc: Record<string, unknown>,
): Record<string, unknown> | null {
  const cls = asRecord(enc.class);
  if (!cls) return null;
  const codings = cls.coding;
  if (!Array.isArray(codings) || codings.length === 0) return null;
  return asRecord(codings[0]);
}

function pickClassCodeUpper(enc: Record<string, unknown>): string | null {
  const c0 = pickClassPrimaryCoding(enc);
  const code = c0?.code;
  return typeof code === "string" ? code.trim().toUpperCase() : null;
}

function pickPlaceOfService(enc: Record<string, unknown>): string | null {
  const fromCc = scanServiceTypeAndTypeForCmsPos(enc);
  if (fromCc) return fromCc;

  const clsCode = pickClassCodeUpper(enc);
  if (clsCode && ACT_CLASS_CODE_TO_CMS_POS[clsCode]) {
    return ACT_CLASS_CODE_TO_CMS_POS[clsCode];
  }

  const cls = asRecord(enc.class);
  const clsText = cls && typeof cls.text === "string" ? cls.text.trim() : "";
  if (clsText) return truncateLabel(clsText);

  const locs = enc.location;
  if (Array.isArray(locs) && locs.length > 0) {
    const row = asRecord(locs[0]);
    const locRef = row?.location;
    const refRec = asRecord(locRef);
    const d =
      refRec && typeof refRec.display === "string"
        ? refRec.display.trim()
        : "";
    if (d) return truncateLabel(d);
  }

  return null;
}

function pickVisitType(enc: Record<string, unknown>): string | null {
  const cls = asRecord(enc.class);
  if (cls) {
    const c0 = pickClassPrimaryCoding(enc);
    if (c0) {
      const disp = c0.display;
      if (typeof disp === "string" && disp.trim()) {
        return truncateLabel(disp);
      }
      const code = c0.code;
      if (typeof code === "string" && code.trim()) {
        return truncateLabel(code);
      }
    }
    const text = cls.text;
    if (typeof text === "string" && text.trim()) {
      return truncateLabel(text);
    }
  }

  const types = enc.type;
  if (Array.isArray(types) && types.length > 0) {
    const t0 = asRecord(types[0]);
    if (t0) {
      const ttext = t0.text;
      if (typeof ttext === "string" && ttext.trim()) {
        return truncateLabel(ttext);
      }
      const coding = t0.coding;
      if (Array.isArray(coding) && coding.length > 0) {
        const c = asRecord(coding[0]);
        const disp = c?.display;
        if (typeof disp === "string" && disp.trim()) {
          return truncateLabel(disp);
        }
        const code = c?.code;
        if (typeof code === "string" && code.trim()) {
          return truncateLabel(code);
        }
      }
    }
  }

  const st = asRecord(enc.serviceType);
  if (st) {
    const codings = st.coding;
    if (Array.isArray(codings) && codings.length > 0) {
      const c = asRecord(codings[0]);
      const disp = c?.display;
      if (typeof disp === "string" && disp.trim()) {
        return truncateLabel(disp);
      }
      const code = c?.code;
      if (typeof code === "string" && code.trim()) {
        return truncateLabel(code);
      }
    }
    const stext = st.text;
    if (typeof stext === "string" && stext.trim()) {
      return truncateLabel(stext);
    }
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
      placeOfService: pickPlaceOfService(rec),
      visitType: pickVisitType(rec),
    },
  };
}

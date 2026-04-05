/**
 * Minimal R4 Bundle → Patient + Encounter for pilot testing without a live EHR.
 * Supports common Synthea / vendor test bundles; not a full FHIR server.
 */

import {
  foreignMinorToUsdCents,
  minorDecimalPlacesForCurrency,
  resolveFhirImportFxStrict,
  type FhirFxLedger,
} from "@/lib/fhir-fx";

export type FhirClaimStatementLine = {
  code: string;
  description: string;
  amountCents: number;
};

export type NormalizedFhirPatientEncounter = {
  mrn: string | null;
  firstName: string;
  lastName: string;
  dob: Date | null;
  dateOfService: Date;
  chiefComplaint: string | null;
  visitSummary: string;
  /**
   * Present when the bundle includes an R4 **Claim** for this patient with at
   * least one `item.net` line — maps into Pay `StatementLine` rows.
   */
  claimStatement?: {
    lines: FhirClaimStatementLine[];
    /** Present when exactly one Claim contributed lines (Pay / audit convenience). */
    claimLogicalId: string | null;
    /** All contributing Claim `id`s (stable sorted order). May be empty if resources omit `id`. */
    claimIds: string[];
    /** Claim resources merged; may exceed **claimIds.length** when `id` is omitted. */
    claimResourceCount: number;
    /** FX to USD for **Pay**; omitted when all lines were already USD. */
    fhirFx?: {
      skippedLineCount: number;
      usedEnvRates: boolean;
      usedBuiltinRates: boolean;
    };
  };
  /** FHIR `Patient.id` from bundle when present — connector / idempotency (see ExternalIdentifier). */
  fhirPatientLogicalId?: string | null;
  /** FHIR `Encounter.id` from bundle when present. */
  fhirEncounterLogicalId?: string | null;
  /**
   * R4 **ExplanationOfBenefit** for this patient — operations trace only (NO **835** parsing).
   */
  explanationOfBenefit?: {
    resourceCount: number;
    logicalIds: string[];
    /** `Claim` logical ids from **`claim`** when present. */
    linkedClaimIds: string[];
    outcomes: string[];
  };
};

export type FhirNormalizeResult =
  | { ok: true; data: NormalizedFhirPatientEncounter }
  | { ok: false; error: string };

/** Optional flags for **`normalizeFhirBundlePayload`**. */
export type NormalizeFhirBundleOptions = {
  /**
   * Override **`FHIR_IMPORT_FX_STRICT`** (see **`resolveFhirImportFxStrict`** in **`fhir-fx`**).
   */
  fxStrict?: boolean;
};

type ClaimExtractResult =
  | { kind: "absent" }
  | {
      kind: "ok";
      claimStatement: NonNullable<
        NormalizedFhirPatientEncounter["claimStatement"]
      >;
    }
  | { kind: "error"; message: string };

const MAX_BUNDLE_BYTES = 2_000_000;
const MAX_CLAIM_LINES = 50;
const MAX_CLAIM_RESOURCES = 20;
const MAX_EOB_RESOURCES = 15;

function asRecord(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : null;
}

function bundleResources(bundle: Record<string, unknown>): unknown[] {
  const ent = bundle.entry;
  if (!Array.isArray(ent)) return [];
  const out: unknown[] = [];
  for (const e of ent) {
    const er = asRecord(e);
    const res = er?.resource;
    if (res) out.push(res);
  }
  return out;
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
    if (given || family) {
      return {
        first: given || "Unknown",
        last: family || "Patient",
      };
    }
  }
  return { first: "Unknown", last: "Patient" };
}

function patientMrn(p: Record<string, unknown>): string | null {
  if (typeof p.id === "string" && p.id.trim()) return p.id.trim();
  const ids = p.identifier;
  if (Array.isArray(ids)) {
    for (const id of ids) {
      const ir = asRecord(id);
      const val = ir?.value;
      if (typeof val === "string" && val.trim()) return val.trim();
    }
  }
  return null;
}

function patientDob(p: Record<string, unknown>): Date | null {
  const b = p.birthDate;
  if (typeof b !== "string" || !b.trim()) return null;
  const d = new Date(b);
  return Number.isNaN(d.getTime()) ? null : d;
}

function refPatientId(reference: unknown): string | null {
  if (typeof reference !== "string") return null;
  const m = reference.match(/^Patient\/([^/]+)/);
  return m ? m[1]! : null;
}

function encounterSubjectPatientId(e: Record<string, unknown>): string | null {
  const subj = e.subject;
  if (typeof subj === "string") return refPatientId(subj);
  const sr = asRecord(subj);
  if (typeof sr?.reference === "string") return refPatientId(sr.reference);
  return null;
}

function encounterDos(e: Record<string, unknown>): Date {
  const period = asRecord(e.period);
  const start = period?.start;
  if (typeof start === "string" && start.trim()) {
    const d = new Date(start);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const end = period?.end;
  if (typeof end === "string" && end.trim()) {
    const d = new Date(end);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function claimPatientReference(c: Record<string, unknown>): string | null {
  const p = c.patient;
  if (typeof p === "string") return refPatientId(p);
  const pr = asRecord(p);
  if (typeof pr?.reference === "string") return refPatientId(pr.reference);
  return null;
}

function refClaimLogicalId(reference: string): string | null {
  const m = reference.match(/^Claim\/([^/]+)/);
  return m ? m[1]! : null;
}

function eobPatientReference(eob: Record<string, unknown>): string | null {
  const p = eob.patient;
  if (typeof p === "string") return refPatientId(p);
  const pr = asRecord(p);
  if (typeof pr?.reference === "string") return refPatientId(pr.reference);
  return null;
}

function eobLinkedClaimId(eob: Record<string, unknown>): string | null {
  const c = eob.claim;
  if (typeof c === "string") return refClaimLogicalId(c);
  const cr = asRecord(c);
  if (typeof cr?.reference === "string")
    return refClaimLogicalId(cr.reference);
  return null;
}

function eobOutcome(eob: Record<string, unknown>): string | null {
  const o = eob.outcome;
  if (typeof o === "string" && o.trim()) return o.trim().slice(0, 48);
  const or = asRecord(o);
  if (typeof or?.coding === "object") {
    const cod = Array.isArray(or.coding) ? asRecord(or.coding[0]) : null;
    if (cod && typeof cod.code === "string" && cod.code.trim())
      return cod.code.trim().slice(0, 48);
  }
  return null;
}

/**
 * R4 **Money** → integer minor units of the stated (or implied USD) currency.
 */
function moneyToMinorUnits(
  raw: unknown,
): { minor: number; currency: string } | null {
  const m = asRecord(raw);
  if (!m) return null;
  const v = m.value;
  const num =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? parseFloat(v)
        : NaN;
  if (Number.isNaN(num) || num < 0) return null;
  const curRaw = m.currency;
  const currency =
    typeof curRaw === "string" && curRaw.trim()
      ? curRaw.trim().toUpperCase()
      : "USD";
  const exp = minorDecimalPlacesForCurrency(currency);
  const mult = 10 ** exp;
  const minor = Math.round(num * mult);
  return { minor, currency };
}

function parseClaimLineItems(
  claim: Record<string, unknown>,
  codePrefix: string,
  fxLedger: FhirFxLedger,
): FhirClaimStatementLine[] {
  const items = claim.item;
  if (!Array.isArray(items)) return [];
  const out: FhirClaimStatementLine[] = [];
  let seq = 0;
  for (const it of items) {
    const ir = asRecord(it);
    if (!ir) continue;
    const parsed = moneyToMinorUnits(ir.net);
    if (parsed === null || parsed.minor <= 0) continue;
    const pos = asRecord(ir.productOrService);
    let code = `${codePrefix}CLAIM-${++seq}`.slice(0, 48);
    let description = "FHIR Claim item";
    if (pos) {
      const coding = Array.isArray(pos.coding) ? asRecord(pos.coding[0]) : null;
      if (coding && typeof coding.code === "string" && coding.code.trim()) {
        code = `${codePrefix}${coding.code.trim()}`.slice(0, 48);
      }
      if (coding && typeof coding.display === "string" && coding.display.trim()) {
        description = coding.display.trim().slice(0, 220);
      } else if (typeof pos.text === "string" && pos.text.trim()) {
        description = pos.text.trim().slice(0, 220);
      }
    }
    let amountCents: number;
    if (parsed.currency === "USD" || parsed.currency === "USN") {
      amountCents = parsed.minor;
    } else {
      const usd = foreignMinorToUsdCents(
        parsed.minor,
        parsed.currency,
        fxLedger,
      );
      if (usd === null) continue;
      amountCents = usd;
      description = `${description} [FX→USD ${parsed.currency}]`.slice(0, 240);
    }
    out.push({ code, description, amountCents });
    if (out.length >= MAX_CLAIM_LINES) break;
  }
  return out;
}

function claimMatchesPatient(
  pid: string | null,
  patientLogicalId: string | null,
  mrn: string | null,
): boolean {
  if (!pid) return false;
  if (
    patientLogicalId &&
    pid !== patientLogicalId &&
    (mrn == null || pid !== mrn)
  ) {
    return false;
  }
  if (!patientLogicalId && mrn && pid !== mrn) return false;
  return true;
}

function extractClaimStatement(
  resources: unknown[],
  patientLogicalId: string | null,
  mrn: string | null,
  fxStrict: boolean,
): ClaimExtractResult {
  if (patientLogicalId == null && mrn == null) return { kind: "absent" };

  const fxLedger: FhirFxLedger = {
    skippedNoRate: 0,
    usedEnvRate: false,
    usedBuiltinRate: false,
  };

  const matching: Record<string, unknown>[] = [];
  for (const r of resources) {
    const rec = asRecord(r);
    if (rec?.resourceType !== "Claim") continue;
    const pid = claimPatientReference(rec);
    if (!claimMatchesPatient(pid, patientLogicalId, mrn)) continue;
    matching.push(rec);
    if (matching.length >= MAX_CLAIM_RESOURCES) break;
  }

  if (matching.length === 0) return { kind: "absent" };

  matching.sort((a, b) => {
    const ia = typeof a.id === "string" ? a.id : "";
    const ib = typeof b.id === "string" ? b.id : "";
    return ia.localeCompare(ib);
  });

  const claimIds: string[] = [];
  const lines: FhirClaimStatementLine[] = [];
  const multi = matching.length > 1;

  for (let i = 0; i < matching.length; i++) {
    const rec = matching[i]!;
    const cid = typeof rec.id === "string" ? rec.id : null;
    if (cid) claimIds.push(cid);
    const codePrefix = multi ? `C${i + 1}-` : "";
    for (const line of parseClaimLineItems(rec, codePrefix, fxLedger)) {
      lines.push(line);
      if (lines.length >= MAX_CLAIM_LINES) break;
    }
    if (lines.length >= MAX_CLAIM_LINES) break;
  }

  const total = lines.reduce((s, x) => s + x.amountCents, 0);
  if (total <= 0 || lines.length === 0) {
    if (fxStrict && matching.length > 0) {
      const detail =
        fxLedger.skippedNoRate > 0
          ? `${fxLedger.skippedNoRate} claim line(s) skipped (no FX rate for currency).`
          : "No billable item.net lines on matching Claim(s).";
      return {
        kind: "error",
        message: `${detail} Add FHIR_IMPORT_FX_RATES_JSON or unset FHIR_IMPORT_FX_STRICT.`,
      };
    }
    return { kind: "absent" };
  }

  if (fxStrict && fxLedger.skippedNoRate > 0) {
    return {
      kind: "error",
      message: `${fxLedger.skippedNoRate} non-USD claim line(s) skipped (no FX rate). Set FHIR_IMPORT_FX_RATES_JSON or unset FHIR_IMPORT_FX_STRICT.`,
    };
  }

  const claimLogicalId =
    matching.length === 1 && claimIds.length === 1 ? claimIds[0]! : null;

  const fhirFx =
    fxLedger.skippedNoRate > 0 ||
    fxLedger.usedEnvRate ||
    fxLedger.usedBuiltinRate
      ? {
          skippedLineCount: fxLedger.skippedNoRate,
          usedEnvRates: fxLedger.usedEnvRate,
          usedBuiltinRates: fxLedger.usedBuiltinRate,
        }
      : undefined;

  const claimStatement: NonNullable<
    NormalizedFhirPatientEncounter["claimStatement"]
  > = {
    lines,
    claimLogicalId,
    claimIds,
    claimResourceCount: matching.length,
    ...(fhirFx ? { fhirFx } : {}),
  };

  return { kind: "ok", claimStatement };
}

function extractExplanationOfBenefitBundle(
  resources: unknown[],
  patientLogicalId: string | null,
  mrn: string | null,
): {
  resourceCount: number;
  logicalIds: string[];
  linkedClaimIds: string[];
  outcomes: string[];
} | null {
  if (patientLogicalId == null && mrn == null) return null;

  const matching: Record<string, unknown>[] = [];
  for (const r of resources) {
    const rec = asRecord(r);
    if (rec?.resourceType !== "ExplanationOfBenefit") continue;
    const pid = eobPatientReference(rec);
    if (!claimMatchesPatient(pid, patientLogicalId, mrn)) continue;
    matching.push(rec);
    if (matching.length >= MAX_EOB_RESOURCES) break;
  }
  if (matching.length === 0) return null;

  matching.sort((a, b) => {
    const ia = typeof a.id === "string" ? a.id : "";
    const ib = typeof b.id === "string" ? b.id : "";
    return ia.localeCompare(ib);
  });

  const logicalIds: string[] = [];
  const linkedSet = new Set<string>();
  const outcomes: string[] = [];

  for (const rec of matching) {
    if (typeof rec.id === "string" && rec.id) logicalIds.push(rec.id);
    const lc = eobLinkedClaimId(rec);
    if (lc) linkedSet.add(lc);
    const oc = eobOutcome(rec);
    if (oc) outcomes.push(oc);
  }

  return {
    resourceCount: matching.length,
    logicalIds,
    linkedClaimIds: [...linkedSet].sort(),
    outcomes: [...new Set(outcomes)].slice(0, 20),
  };
}

function encounterComplaint(e: Record<string, unknown>): string | null {
  const reasons = e.reasonCode;
  if (Array.isArray(reasons) && reasons.length > 0) {
    const r = asRecord(reasons[0]);
    const coding = r?.coding;
    if (Array.isArray(coding) && coding.length > 0) {
      const c = asRecord(coding[0]);
      if (typeof c?.display === "string" && c.display.trim()) return c.display;
    }
    if (typeof r?.text === "string" && r.text.trim()) return r.text;
  }
  const cls = asRecord(e.class);
  if (typeof cls?.display === "string" && cls.display.trim())
    return cls.display;
  return null;
}

/** Parse JSON text; validates Bundle + finds Patient + Encounter. */
export function normalizeFhirBundlePayload(
  jsonText: string,
  options?: NormalizeFhirBundleOptions,
): FhirNormalizeResult {
  if (jsonText.length > MAX_BUNDLE_BYTES) {
    return { ok: false, error: "Bundle too large (max 2MB)." };
  }
  let root: unknown;
  try {
    root = JSON.parse(jsonText) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  const bundle = asRecord(root);
  if (!bundle || bundle.resourceType !== "Bundle") {
    return { ok: false, error: "Root must be a FHIR Bundle." };
  }
  const resources = bundleResources(bundle);
  let patientRec: Record<string, unknown> | null = null;
  let patientLogicalId: string | null = null;
  for (const r of resources) {
    const rec = asRecord(r);
    if (rec?.resourceType === "Patient") {
      patientRec = rec;
      if (typeof rec.id === "string") patientLogicalId = rec.id;
      break;
    }
  }
  if (!patientRec) {
    return { ok: false, error: "No Patient resource found in bundle." };
  }

  const mrn = patientMrn(patientRec);
  const dob = patientDob(patientRec);
  const { first, last } = patientName(patientRec);

  let encounterRec: Record<string, unknown> | null = null;
  for (const r of resources) {
    const rec = asRecord(r);
    if (rec?.resourceType !== "Encounter") continue;
    const ePid = encounterSubjectPatientId(rec);
    if (
      ePid &&
      patientLogicalId &&
      (ePid === patientLogicalId || ePid === mrn)
    ) {
      encounterRec = rec;
      break;
    }
  }
  if (!encounterRec) {
    for (const r of resources) {
      const rec = asRecord(r);
      if (rec?.resourceType === "Encounter") {
        encounterRec = rec;
        break;
      }
    }
  }
  if (!encounterRec) {
    return { ok: false, error: "No Encounter resource found in bundle." };
  }

  const dateOfService = encounterDos(encounterRec);
  const chief = encounterComplaint(encounterRec);
  const encId =
    typeof encounterRec.id === "string" ? encounterRec.id : "unknown";
  const visitSummary = [
    "Imported from FHIR R4 fixture (pilot test).",
    encId !== "unknown" ? `EHR Encounter id: ${encId}.` : "",
    chief ? `Reason / class: ${chief}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const fxStrict = resolveFhirImportFxStrict(options?.fxStrict);
  const claimExtract = extractClaimStatement(
    resources,
    patientLogicalId,
    mrn,
    fxStrict,
  );
  if (claimExtract.kind === "error") {
    return { ok: false, error: claimExtract.message };
  }
  const claimStatement =
    claimExtract.kind === "ok" ? claimExtract.claimStatement : undefined;
  const explanationOfBenefit = extractExplanationOfBenefitBundle(
    resources,
    patientLogicalId,
    mrn,
  );

  const visitNoteEob =
    explanationOfBenefit != null
      ? ` R4 ExplanationOfBenefit: ${explanationOfBenefit.resourceCount} resource(s).`
      : "";
  const visitSummaryFull = `${visitSummary}${visitNoteEob}`.trim();

  const encLogical =
    typeof encounterRec.id === "string" && encounterRec.id.trim()
      ? encounterRec.id.trim()
      : null;

  return {
    ok: true,
    data: {
      mrn,
      firstName: first,
      lastName: last,
      dob,
      dateOfService,
      chiefComplaint: chief,
      visitSummary: visitSummaryFull,
      fhirPatientLogicalId: patientLogicalId,
      fhirEncounterLogicalId: encLogical,
      ...(claimStatement ? { claimStatement } : {}),
      ...(explanationOfBenefit ? { explanationOfBenefit } : {}),
    },
  };
}

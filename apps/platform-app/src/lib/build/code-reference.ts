import { normalizeCpt, normalizeIcd10 } from "@/lib/build/retrieval";

/**
 * Short reference labels for common testing/synthetic codes only.
 * Staff should still confirm against payer policy and authoritative code books.
 */
const ICD10_STATIC: Record<string, string> = {
  I10: "Essential (primary) hypertension",
  I209: "Angina pectoris, unspecified",
  E119: "Type 2 diabetes mellitus without complications",
  J459: "Asthma, unspecified",
  M545: "Low back pain, unspecified",
  R079: "Chest pain, unspecified",
  R509: "Fever, unspecified",
  Z0000: "Encounter for general adult medical exam w/o abnormal findings",
  Z0001: "Encounter for general adult medical exam w/ abnormal findings",
  Z23: "Encounter for immunization",
};

const CPT_STATIC: Record<string, string> = {
  "99202": "Office/outpatient new patient, straightforward MDM",
  "99203": "Office/outpatient new patient, low MDM",
  "99204": "Office/outpatient new patient, moderate MDM",
  "99205": "Office/outpatient new patient, high MDM",
  "99211": "Office visit, established, nurse only",
  "99212": "Office/outpatient est patient, straightforward MDM",
  "99213": "Office/outpatient est patient, low MDM",
  "99214": "Office/outpatient est patient, moderate MDM",
  "99215": "Office/outpatient est patient, high MDM",
  "93000": "Electrocardiogram, complete",
  "80053": "Comprehensive metabolic panel",
};

function cleanDescriptor(s: string | null | undefined): string | null {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t || t.length > 400) return null;
  return t;
}

/** Descriptor shown on draft lines: persisted AI value, else static map. */
export function displayIcd10Descriptor(args: {
  icd10: string;
  persisted?: string | null;
}): string | null {
  const norm = normalizeIcd10(args.icd10);
  return (
    cleanDescriptor(args.persisted) ??
    ICD10_STATIC[norm.replace(/\./g, "").toUpperCase()] ??
    ICD10_STATIC[norm.toUpperCase()] ??
    null
  );
}

export function displayCptDescriptor(args: {
  cpt: string;
  persisted?: string | null;
}): string | null {
  const key = normalizeCpt(args.cpt).replace(/[^A-Z0-9]/g, "").slice(0, 5);
  return (
    cleanDescriptor(args.persisted) ?? (key ? CPT_STATIC[key] ?? null : null)
  );
}

/** NLM Clinical Tables search (code-focused). */
export function icd10ExternalLookupUrl(code: string): string {
  const q = encodeURIComponent(normalizeIcd10(code));
  return `https://clinicaltables.nlm.nih.gov/icd10cm/v2/search?sf=code&terms=${q}`;
}

/** AAPC public CPT code page when available; otherwise web search. */
export function cptExternalLookupUrl(code: string): string {
  const c = normalizeCpt(code).replace(/[^A-Z0-9]/g, "").slice(0, 5);
  if (!c) return "https://www.cms.gov/medicare/coding-billing/physician-fee-schedule";
  return `https://www.aapc.com/codes/cpt-codes/${encodeURIComponent(c)}`;
}

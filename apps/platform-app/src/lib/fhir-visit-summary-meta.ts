/**
 * Reads lightweight cues from **`Encounter.visitSummary`** populated by
 * **`normalizeFhirBundlePayload`** / import (no extra DB columns).
 */
export type FhirVisitSummaryMeta = {
  /** True when this encounter came from the FHIR R4 fixture import path. */
  isFhirFixtureImport: boolean;
  /** Count from embedded EOB trace text, or null when none. */
  explanationOfBenefitResourceCount: number | null;
};

const FHIR_FIXTURE_MARKER = "Imported from FHIR R4 fixture";
const EOB_COUNT_RE = /R4 ExplanationOfBenefit:\s*(\d+)\s+resource/i;

export function parseFhirVisitSummaryMeta(
  visitSummary: string,
): FhirVisitSummaryMeta {
  const isFhirFixtureImport = visitSummary.includes(FHIR_FIXTURE_MARKER);
  const m = visitSummary.match(EOB_COUNT_RE);
  const n = m ? parseInt(m[1]!, 10) : NaN;
  const explanationOfBenefitResourceCount =
    Number.isFinite(n) && n > 0 ? n : null;
  return { isFhirFixtureImport, explanationOfBenefitResourceCount };
}

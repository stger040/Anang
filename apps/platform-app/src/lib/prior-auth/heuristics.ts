import type { PriorAuthSignal, PriorAuthSignalCategory } from "./types";
import type { DetectPriorAuthSignalsInput, DetectPriorAuthSignalsResult } from "./types";
import type { PriorAuthSignalCategoryKey } from "./defaults";

function cptNumeric(cpt: string): number | null {
  const t = cpt.trim().toUpperCase();
  if (!/^\d{5}$/.test(t)) return null;
  return parseInt(t, 10);
}

function isAdvancedImagingCpt(n: number): boolean {
  if (n >= 70450 && n <= 70498) return true;
  if (n >= 70551 && n <= 70553) return true;
  if (n >= 71250 && n <= 71275) return true;
  if (n >= 72141 && n <= 72158) return true;
  if (n >= 73200 && n <= 73206) return true;
  if (n >= 73721 && n <= 73723) return true;
  if (n >= 74150 && n <= 74178) return true;
  if (n >= 74261 && n <= 74263) return true;
  if (n >= 75557 && n <= 75574) return true;
  if (n >= 75635 && n <= 75638) return true;
  if (n >= 77061 && n <= 77067) return true;
  if (n >= 78607 && n <= 78611) return true;
  return false;
}

function isTherapyCpt(code: string): boolean {
  return /^971(10|12|16|40|62)$/.test(code) || code === "97530";
}

function isInfusionCpt(code: string): boolean {
  return /^964/.test(code);
}

function isDmeCode(code: string): boolean {
  const u = code.trim().toUpperCase();
  return /^[EKL][0-9]{4}$/.test(u);
}

function isSleepStudyCpt(n: number, code: string): boolean {
  if (/^9580[5-8]$/.test(code)) return true;
  if (/^9578[23]$/.test(code)) return true;
  if (n >= 95810 && n <= 95813) return true;
  return false;
}

function isOutpatientSurgeryContext(
  pos: string | null | undefined,
  n: number | null,
): boolean {
  if (pos === "22") {
    if (n != null && n >= 10000 && n < 70000) return true;
  }
  // Common outpatient procedures (deterministic shortlist — not exhaustive OPPS mapping).
  if (n != null && [27447, 29827, 29881, 47562, 47563, 49650, 58558].includes(n)) return true;
  return false;
}

function categoryEnabled(
  cat: PriorAuthSignalCategory,
  enabled: ReadonlySet<PriorAuthSignalCategoryKey>,
): boolean {
  return enabled.has(cat as PriorAuthSignalCategoryKey);
}

/**
 * Deterministic medical-benefit prior auth signals from encounter + draft lines + coverage.
 * Does not call payers; unknown plan behavior is explicit per tenant settings.
 */
export function detectPriorAuthSignals(
  input: DetectPriorAuthSignalsInput,
  enabledCategories: ReadonlySet<PriorAuthSignalCategoryKey>,
): DetectPriorAuthSignalsResult {
  const signals: PriorAuthSignal[] = [];
  const codesSeen = new Set<string>();

  const add = (s: PriorAuthSignal) => {
    if (!categoryEnabled(s.category, enabledCategories)) return;
    const key = `${s.category}:${s.codes.sort().join(",")}`;
    if (codesSeen.has(key)) return;
    codesSeen.add(key);
    signals.push(s);
  };

  let therapyUnits = 0;
  const therapyCpts: string[] = [];
  const threshold = input.therapyUnitsThreshold ?? 12;

  for (const line of input.lines) {
    const raw = line.cpt.trim().toUpperCase();
    if (!raw) continue;
    const n = cptNumeric(raw);

    if (n != null && isAdvancedImagingCpt(n)) {
      add({
        category: "advanced_imaging",
        codes: [raw],
        rationale:
          "Advanced imaging CPT on the draft often requires medical-benefit prior authorization before scheduling or billing.",
      });
    }

    if (isInfusionCpt(raw)) {
      add({
        category: "infusion",
        codes: [raw],
        rationale:
          "Chemo/therapeutic infusion administration codes commonly require payer authorization.",
      });
    }

    if (isDmeCode(raw)) {
      add({
        category: "dme",
        codes: [raw],
        rationale:
          "DME / supply HCPCS codes frequently require separate authorization or proof of medical necessity.",
      });
    }

    if (n != null && isSleepStudyCpt(n, raw)) {
      add({
        category: "sleep_study",
        codes: [raw],
        rationale: "Sleep diagnostic and titration codes are commonly authorization-gated.",
      });
    }

    if (isTherapyCpt(raw)) {
      therapyUnits += Math.max(1, line.units);
      therapyCpts.push(raw);
    }

    if (n != null && isOutpatientSurgeryContext(input.encounter.placeOfService, n)) {
      add({
        category: "outpatient_surgery_context",
        codes: [raw],
        rationale:
          "Ambulatory surgery center (POS 22) or high-acuity procedure pattern — confirm authorization before claim submission.",
      });
    }
  }

  if (therapyUnits >= threshold && therapyCpts.length) {
    add({
      category: "therapy_units_threshold",
      codes: [...new Set(therapyCpts)].sort(),
      rationale: `Therapy-coded units on this visit sum to ${therapyUnits} (threshold ${threshold}); many plans require PA after cumulative thresholds.`,
    });
  }

  const cov = input.coverages;
  const looksUnknown =
    cov.length === 0 ||
    cov.every(
      (c) =>
        (!c.planName || !String(c.planName).trim()) &&
        (c.status === "unknown" || !String(c.status).trim()),
    ) ||
    (cov.length > 0 && cov.every((c) => c.status === "unknown"));
  const unknownPlanReview =
    input.unknownPlanBehavior === "review_required" && looksUnknown;

  return { signals, unknownPlanReview };
}

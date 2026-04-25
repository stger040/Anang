import { describe, expect, it } from "vitest";

import { DEFAULT_PRIOR_AUTH_HIGH_RISK } from "./defaults";
import { detectPriorAuthSignals } from "./heuristics";

const enabled = new Set(DEFAULT_PRIOR_AUTH_HIGH_RISK);

describe("detectPriorAuthSignals", () => {
  const enc = {
    dateOfService: new Date("2026-03-18T14:00:00Z"),
    placeOfService: "11",
    visitType: null as string | null,
  };

  it("flags advanced imaging CPT band", () => {
    const r = detectPriorAuthSignals(
      {
        lines: [{ cpt: "72148", units: 1 }],
        encounter: enc,
        coverages: [
          { planName: "Open Access", status: "active", payerName: "Demo" },
        ],
        unknownPlanBehavior: "review_required",
      },
      enabled,
    );
    expect(r.signals.some((s) => s.category === "advanced_imaging")).toBe(true);
    expect(r.unknownPlanReview).toBe(false);
  });

  it("unknown plan forces review when behavior is review_required", () => {
    const r = detectPriorAuthSignals(
      {
        lines: [{ cpt: "99213", units: 1 }],
        encounter: enc,
        coverages: [{ planName: "", status: "unknown", payerName: "" }],
        unknownPlanBehavior: "review_required",
      },
      enabled,
    );
    expect(r.signals.length).toBe(0);
    expect(r.unknownPlanReview).toBe(true);
  });

  it("respects disabled category set", () => {
    const r = detectPriorAuthSignals(
      {
        lines: [{ cpt: "72148", units: 1 }],
        encounter: enc,
        coverages: [
          { planName: "Open Access", status: "active", payerName: "Demo" },
        ],
        unknownPlanBehavior: "review_required",
      },
      new Set(),
    );
    expect(r.signals).toHaveLength(0);
  });

  it("sums therapy units against threshold", () => {
    const r = detectPriorAuthSignals(
      {
        lines: [
          { cpt: "97110", units: 6 },
          { cpt: "97112", units: 7 },
        ],
        encounter: enc,
        coverages: [
          { planName: "Open Access", status: "active", payerName: "Demo" },
        ],
        unknownPlanBehavior: "review_required",
        therapyUnitsThreshold: 12,
      },
      enabled,
    );
    expect(r.signals.some((s) => s.category === "therapy_units_threshold")).toBe(
      true,
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  evaluateClaimDraftRules,
  evaluatePriorAuthBuildRuleIssues,
} from "@/lib/build/rules-engine";

import type { ClaimDraftLine, Encounter } from "@prisma/client";
import { ClaimDraftLineSource, ClaimIssueSource } from "@prisma/client";

function line(partial: Partial<ClaimDraftLine> & Pick<ClaimDraftLine, "id">) {
  return {
    id: partial.id,
    draftId: partial.draftId ?? "d1",
    cpt: partial.cpt ?? "99213",
    icd10: partial.icd10 ?? "I10",
    modifier: partial.modifier ?? null,
    units: partial.units ?? 1,
    chargeCents: partial.chargeCents ?? 10000,
    aiRationale: partial.aiRationale ?? "—",
    icd10Descriptor: partial.icd10Descriptor ?? null,
    cptDescriptor: partial.cptDescriptor ?? null,
    lineSource: partial.lineSource ?? ClaimDraftLineSource.IMPORTED,
  } satisfies ClaimDraftLine;
}

const enc = {
  dateOfService: new Date("2026-03-18T14:00:00Z"),
} satisfies Pick<Encounter, "dateOfService">;

const encPos = {
  dateOfService: new Date("2026-03-18T14:00:00Z"),
  placeOfService: "11",
  visitType: null as string | null,
} satisfies Pick<Encounter, "dateOfService" | "placeOfService" | "visitType">;

describe("evaluateClaimDraftRules", () => {
  it("flags empty lines", () => {
    const r = evaluateClaimDraftRules({ lines: [], encounter: enc });
    expect(r).toHaveLength(1);
    expect(r[0]?.ruleKey).toBe("build.lines.required");
    expect(r[0]?.issueSource).toBe(ClaimIssueSource.RULE);
  });

  it("flags missing CPT per line", () => {
    const r = evaluateClaimDraftRules({
      lines: [line({ id: "a", cpt: "  " })],
      encounter: enc,
    });
    expect(r.some((x) => x.ruleKey.startsWith("build.cpt.required:"))).toBe(
      true,
    );
  });

  it("flags E/M plus 93015 pairing", () => {
    const r = evaluateClaimDraftRules({
      lines: [
        line({ id: "1", cpt: "99214", icd10: "I20.9" }),
        line({ id: "2", cpt: "93015", icd10: "I20.9" }),
      ],
      encounter: enc,
    });
    expect(
      r.some((x) => x.ruleKey.startsWith("build.ncci.em.cardiology.pair")),
    ).toBe(true);
  });
});

describe("evaluatePriorAuthBuildRuleIssues", () => {
  it("emits prior_auth warning for deterministic imaging CPT", () => {
    const issues = evaluatePriorAuthBuildRuleIssues({
      lines: [
        line({
          id: "img1",
          cpt: "72148",
          icd10: "M54.5",
          units: 1,
          chargeCents: 120000,
        }),
      ],
      encounter: encPos,
      coverages: [
        { planName: "Open Access", status: "active", payerName: "Demo Health Plan" },
      ],
    });
    expect(
      issues.some(
        (i) => i.category === "prior_auth" && i.ruleKey === "prior_auth.signal.advanced_imaging",
      ),
    ).toBe(true);
  });

  it("emits unknown-plan warning when configured for review", () => {
    const issues = evaluatePriorAuthBuildRuleIssues({
      lines: [line({ id: "a", cpt: "99213", units: 1 })],
      encounter: encPos,
      coverages: [{ planName: "", status: "unknown", payerName: "" }],
      unknownPlanBehavior: "review_required",
    });
    expect(issues.some((i) => i.ruleKey === "prior_auth.plan.unknown")).toBe(true);
  });

  it("suppresses CPT heuristics when category list is empty", () => {
    const issues = evaluatePriorAuthBuildRuleIssues({
      lines: [
        line({
          id: "img1",
          cpt: "72148",
          icd10: "M54.5",
          units: 1,
          chargeCents: 120000,
        }),
      ],
      encounter: encPos,
      coverages: [
        { planName: "Open Access", status: "active", payerName: "Demo Health Plan" },
      ],
      enabledCategoryKeys: [],
    });
    expect(issues.filter((i) => i.category === "prior_auth")).toHaveLength(0);
  });
});

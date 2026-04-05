import { describe, expect, it } from "vitest";

import {
  applyBuildRulePack,
  isRuleKeyDisabled,
  parseBuildRulePackConfig,
  resolveSeverityOverride,
} from "@/lib/build/rule-pack-config";
import type { RuleIssuePayload } from "@/lib/build/rules-engine";
import { ClaimIssueSource } from "@prisma/client";

function sampleIssue(ruleKey: string, severity = "warning"): RuleIssuePayload {
  return {
    ruleKey,
    severity,
    category: "coding",
    title: "T",
    detail: "D",
    explainability: "E",
    issueSource: ClaimIssueSource.RULE,
  };
}

describe("parseBuildRulePackConfig", () => {
  it("accepts empty", () => {
    const r = parseBuildRulePackConfig({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.disabledRuleKeys).toBeUndefined();
  });

  it("rejects bad severity", () => {
    const r = parseBuildRulePackConfig({
      severityOverrides: { foo: "nope" },
    });
    expect(r.ok).toBe(false);
  });
});

describe("isRuleKeyDisabled", () => {
  it("matches exact and wildcard", () => {
    expect(
      isRuleKeyDisabled("build.lines.required", [
        "build.other",
        "build.lines.required",
      ]),
    ).toBe(true);
    expect(
      isRuleKeyDisabled("build.cpt.required:abc", ["build.cpt.required:*"]),
    ).toBe(true);
    expect(isRuleKeyDisabled("build.cpt.required:abc", ["build.units*"])).toBe(
      false,
    );
  });
});

describe("resolveSeverityOverride", () => {
  it("prefers longer key", () => {
    expect(
      resolveSeverityOverride("build.icd10.required:x", {
        build: "info",
        "build.icd10.required": "critical",
      }),
    ).toBe("critical");
  });
});

describe("applyBuildRulePack", () => {
  it("filters and overrides", () => {
    const issues = [
      sampleIssue("build.ncci.em.cardiology.pair:93015_992xx", "warning"),
      sampleIssue("build.icd10.required:line1", "warning"),
    ];
    const next = applyBuildRulePack(issues, {
      disabledRuleKeys: ["build.ncci.em.cardiology.pair:93015_992xx"],
      severityOverrides: { "build.icd10.required": "info" },
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.ruleKey).toBe("build.icd10.required:line1");
    expect(next[0]?.severity).toBe("info");
  });
});

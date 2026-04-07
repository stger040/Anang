import { describe, expect, it } from "vitest";

import { evaluateClaimDraftRules } from "@/lib/build/rules-engine";

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
    lineSource: partial.lineSource ?? ClaimDraftLineSource.IMPORTED,
  } satisfies ClaimDraftLine;
}

const enc = {
  dateOfService: new Date("2026-03-18T14:00:00Z"),
} satisfies Pick<Encounter, "dateOfService">;

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

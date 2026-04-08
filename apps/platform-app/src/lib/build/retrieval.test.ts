import { describe, expect, it } from "vitest";

import {
  codeLookupsForRule,
  excerptForCitation,
  lineIdFromRuleKeySuffix,
  normalizeCpt,
  normalizeIcd10,
} from "@/lib/build/retrieval";

import { ClaimDraftLineSource, type ClaimDraftLine } from "@prisma/client";

function line(
  partial: Partial<ClaimDraftLine> & Pick<ClaimDraftLine, "id" | "cpt" | "icd10">,
): ClaimDraftLine {
  return {
    id: partial.id,
    draftId: partial.draftId ?? "d1",
    cpt: partial.cpt,
    icd10: partial.icd10,
    modifier: partial.modifier ?? null,
    units: partial.units ?? 1,
    chargeCents: partial.chargeCents ?? 10000,
    aiRationale: partial.aiRationale ?? "—",
    icd10Descriptor: partial.icd10Descriptor ?? null,
    cptDescriptor: partial.cptDescriptor ?? null,
    lineSource: partial.lineSource ?? ClaimDraftLineSource.IMPORTED,
  };
}

describe("retrieval helpers", () => {
  it("normalizes CPT and ICD-10", () => {
    expect(normalizeCpt(" 99214\n")).toBe("99214");
    expect(normalizeIcd10(" i20.9 ")).toBe("I20.9");
  });

  it("extracts line id suffix from rule keys", () => {
    const suffix = "clqw7abcdefghijklmnopqrstuv"; // 25 chars, cuid-shaped
    expect(lineIdFromRuleKeySuffix(`build.cpt.required:${suffix}`)).toBe(
      suffix,
    );
    expect(lineIdFromRuleKeySuffix("build.lines.required")).toBeNull();
    expect(lineIdFromRuleKeySuffix("build.foo:short")).toBeNull();
  });

  it("maps rule keys to code lookups for NCCI pair rule", () => {
    const lines = [
      line({ id: "a", cpt: "93015", icd10: "I20.9" }),
      line({ id: "b", cpt: "99214", icd10: "I10" }),
    ];
    const look = codeLookupsForRule(
      "build.ncci.em.cardiology.pair:any",
      lines,
    );
    expect(look.map((x) => `${x.kind}:${x.lookup}`).sort()).toEqual([
      "cpt:93015",
      "cpt:99214",
    ]);
  });

  it("maps suffixed keys to CPT/ICD for a line", () => {
    const lineId = "clqw7abcdefghijklmnopqrstuv";
    const lines = [line({ id: lineId, cpt: "", icd10: "I10" })];
    expect(codeLookupsForRule(`build.cpt.required:${lineId}`, lines)).toEqual(
      [],
    );

    const lines2 = [line({ id: lineId, cpt: "99213", icd10: "I10" })];
    expect(
      codeLookupsForRule(`build.cpt.required:${lineId}`, lines2),
    ).toEqual([{ kind: "cpt", lookup: "99213" }]);
    expect(
      codeLookupsForRule(`build.icd10.required:${lineId}`, lines2),
    ).toEqual([{ kind: "icd10", lookup: "I10" }]);
  });

  it("truncates long excerpts", () => {
    const long = "x".repeat(400);
    const ex = excerptForCitation(long);
    expect(ex.length).toBeLessThanOrEqual(280);
    expect(ex.endsWith("…")).toBe(true);
  });
});

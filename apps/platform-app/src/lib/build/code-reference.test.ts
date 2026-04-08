import { describe, expect, it } from "vitest";

import {
  displayCptDescriptor,
  displayIcd10Descriptor,
  icd10ExternalLookupUrl,
} from "@/lib/build/code-reference";

describe("code-reference", () => {
  it("resolves static ICD-10 descriptors", () => {
    expect(
      displayIcd10Descriptor({ icd10: "I10", persisted: null }),
    ).toContain("hypertension");
    expect(
      displayIcd10Descriptor({ icd10: "Z00.00", persisted: null }),
    ).toBeTruthy();
  });

  it("prefers persisted descriptor over static", () => {
    expect(
      displayIcd10Descriptor({
        icd10: "I10",
        persisted: "Custom label from model",
      }),
    ).toBe("Custom label from model");
  });

  it("resolves static CPT descriptors", () => {
    const d = displayCptDescriptor({ cpt: "99213", persisted: null });
    expect(d).toBeTruthy();
    expect(d).toMatch(/office|outpatient|established/i);
  });

  it("builds ICD-10 lookup URL with encoded code", () => {
    expect(icd10ExternalLookupUrl("I10")).toContain("I10");
    expect(icd10ExternalLookupUrl("I10")).toContain("clinicaltables.nlm.nih.gov");
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function bundleJson(resources: unknown[]) {
  return JSON.stringify({
    resourceType: "Bundle",
    entry: resources.map((resource) => ({ resource })),
  });
}

const patientJane = {
  resourceType: "Patient",
  id: "p1",
  name: [{ given: ["Jane"], family: "Doe" }],
};

const encounterForP1 = {
  resourceType: "Encounter",
  id: "e1",
  subject: { reference: "Patient/p1" },
  period: { start: "2024-01-15T10:00:00Z" },
};

describe("normalizeFhirBundlePayload", () => {
  afterEach(() => {
    delete process.env.FHIR_IMPORT_FX_STRICT;
    delete process.env.FHIR_IMPORT_FX_RATES_JSON;
    vi.resetModules();
  });

  it("normalizes Patient + Encounter without Claim", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.firstName).toBe("Jane");
    expect(r.data.lastName).toBe("Doe");
    expect(r.data.claimStatement).toBeUndefined();
    expect(r.data.dateOfService.toISOString().slice(0, 10)).toBe("2024-01-15");
  });

  it("rejects non-Bundle root", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const r = normalizeFhirBundlePayload("{}");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("Bundle");
  });

  it("extracts USD Claim item.net lines", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const claim = {
      resourceType: "Claim",
      id: "c1",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 25.5, currency: "USD" },
          productOrService: { text: "Office visit" },
        },
      ],
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, claim]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.claimStatement) return;
    expect(r.data.claimStatement.lines).toHaveLength(1);
    expect(r.data.claimStatement.lines[0]!.amountCents).toBe(2550);
    expect(r.data.claimStatement.lines[0]!.description).toContain("Office visit");
    expect(r.data.claimStatement.fhirFx).toBeUndefined();
  });

  it("converts foreign Claim currency with built-in FX", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const claim = {
      resourceType: "Claim",
      id: "c-eur",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 10, currency: "EUR" },
          productOrService: { text: "Service" },
        },
      ],
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, claim]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.claimStatement) return;
    expect(r.data.claimStatement.lines[0]!.amountCents).toBe(1080);
    expect(r.data.claimStatement.fhirFx?.usedBuiltinRates).toBe(true);
    expect(r.data.claimStatement.lines[0]!.description).toContain("FX→USD");
  });

  it("rejects unknown currency in strict mode", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const claim = {
      resourceType: "Claim",
      id: "c-xts",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 10, currency: "XTS" },
          productOrService: { text: "Bad line" },
        },
      ],
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, claim]),
      { fxStrict: true },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/FX|rate|skipped/i);
  });

  it("merges multiple Claim resources for the same patient (prefixed line codes)", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const claimAlpha = {
      resourceType: "Claim",
      id: "c-alpha",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 100, currency: "USD" },
          productOrService: {
            coding: [{ code: "99213", display: "Office visit established" }],
          },
        },
      ],
    };
    const claimBeta = {
      resourceType: "Claim",
      id: "c-beta",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 45.5, currency: "USD" },
          productOrService: {
            coding: [{ code: "99214", display: "Office visit extended" }],
          },
        },
      ],
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([
        patientJane,
        encounterForP1,
        claimBeta,
        claimAlpha,
      ]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.claimStatement) return;
    expect(r.data.claimStatement.claimResourceCount).toBe(2);
    expect(r.data.claimStatement.claimIds).toEqual(["c-alpha", "c-beta"]);
    expect(r.data.claimStatement.claimLogicalId).toBeNull();
    expect(r.data.claimStatement.lines).toHaveLength(2);
    expect(r.data.claimStatement.lines.map((l) => l.code)).toEqual([
      "C1-99213",
      "C2-99214",
    ]);
    expect(r.data.claimStatement.lines.map((l) => l.amountCents)).toEqual([
      10_000,
      4550,
    ]);
  });

  it("returns both Claim statement lines and EOB trace in one bundle (vendor-style)", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const claim = {
      resourceType: "Claim",
      id: "c-pro",
      patient: { reference: "Patient/p1" },
      item: [
        {
          net: { value: 80, currency: "USD" },
          productOrService: { text: "Professional component" },
        },
      ],
    };
    const eob = {
      resourceType: "ExplanationOfBenefit",
      id: "eob-adj",
      patient: { reference: "Patient/p1" },
      claim: { reference: "Claim/c-pro" },
      outcome: "queued",
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, claim, eob]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.claimStatement || !r.data.explanationOfBenefit) return;
    expect(r.data.claimStatement.claimLogicalId).toBe("c-pro");
    expect(r.data.claimStatement.lines).toHaveLength(1);
    expect(r.data.claimStatement.lines[0]!.amountCents).toBe(8000);
    expect(r.data.explanationOfBenefit.resourceCount).toBe(1);
    expect(r.data.explanationOfBenefit.linkedClaimIds).toEqual(["c-pro"]);
    expect(r.data.explanationOfBenefit.outcomes).toEqual(["queued"]);
    expect(r.data.visitSummary).toContain("ExplanationOfBenefit");
  });

  it("records ExplanationOfBenefit trace for the bundled patient", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const eob = {
      resourceType: "ExplanationOfBenefit",
      id: "eob-1",
      patient: { reference: "Patient/p1" },
      claim: { reference: "Claim/c-alpha" },
      outcome: "complete",
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, eob]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.explanationOfBenefit) return;
    expect(r.data.explanationOfBenefit.resourceCount).toBe(1);
    expect(r.data.explanationOfBenefit.logicalIds).toEqual(["eob-1"]);
    expect(r.data.explanationOfBenefit.linkedClaimIds).toEqual(["c-alpha"]);
    expect(r.data.explanationOfBenefit.outcomes).toEqual(["complete"]);
    expect(r.data.visitSummary).toContain("ExplanationOfBenefit");
  });

  it("merges multiple ExplanationOfBenefit resources (sorted ids, deduped outcomes)", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const eobZ = {
      resourceType: "ExplanationOfBenefit",
      id: "eob-zebra",
      patient: { reference: "Patient/p1" },
      outcome: { coding: [{ code: "partial" }] },
    };
    const eobA = {
      resourceType: "ExplanationOfBenefit",
      id: "eob-alpha",
      patient: { reference: "Patient/p1" },
      outcome: "complete",
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, eobZ, eobA]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.explanationOfBenefit) return;
    expect(r.data.explanationOfBenefit.resourceCount).toBe(2);
    expect(r.data.explanationOfBenefit.logicalIds).toEqual([
      "eob-alpha",
      "eob-zebra",
    ]);
    expect(r.data.explanationOfBenefit.outcomes).toEqual(["complete", "partial"]);
  });

  it("normalizes shipped example file from fixtures/fhir", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const file = path.join(
      process.cwd(),
      "fixtures/fhir/minimal-patient-encounter-claim.example.json",
    );
    const json = readFileSync(file, "utf8");
    const r = normalizeFhirBundlePayload(json);
    expect(r.ok).toBe(true);
    if (!r.ok || !r.data.claimStatement) return;
    expect(r.data.firstName).toBe("Jane");
    expect(r.data.claimStatement.lines).toHaveLength(1);
    expect(r.data.claimStatement.lines[0]!.amountCents).toBe(2550);
  });

  it("ignores ExplanationOfBenefit for a different patient", async () => {
    const { normalizeFhirBundlePayload } = await import("./fhir-fixture-import");
    const eob = {
      resourceType: "ExplanationOfBenefit",
      id: "eob-other",
      patient: { reference: "Patient/other" },
      outcome: "complete",
    };
    const r = normalizeFhirBundlePayload(
      bundleJson([patientJane, encounterForP1, eob]),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.explanationOfBenefit).toBeUndefined();
    expect(r.data.visitSummary).not.toContain("ExplanationOfBenefit");
  });
});

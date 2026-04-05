import { afterEach, describe, expect, it, vi } from "vitest";

describe("foreignMinorToUsdCents", () => {
  afterEach(() => {
    delete process.env.FHIR_IMPORT_FX_RATES_JSON;
    vi.resetModules();
  });

  it("passes through USD minor units", async () => {
    const { foreignMinorToUsdCents } = await import("./fhir-fx");
    const ledger = {
      skippedNoRate: 0,
      usedEnvRate: false,
      usedBuiltinRate: false,
    };
    expect(foreignMinorToUsdCents(12_345, "USD", ledger)).toBe(12_345);
    expect(foreignMinorToUsdCents(12_345, "usn", ledger)).toBe(12_345);
    expect(ledger.usedBuiltinRate).toBe(false);
    expect(ledger.usedEnvRate).toBe(false);
    expect(ledger.skippedNoRate).toBe(0);
  });

  it("converts EUR minor units with built-in rate", async () => {
    const { foreignMinorToUsdCents } = await import("./fhir-fx");
    const ledger = {
      skippedNoRate: 0,
      usedEnvRate: false,
      usedBuiltinRate: false,
    };
    // 10.00 EUR → 1000 minor (2 decimals); × 1.08 USD/EUR → $10.80 → 1080¢
    expect(foreignMinorToUsdCents(1000, "EUR", ledger)).toBe(1080);
    expect(ledger.usedBuiltinRate).toBe(true);
    expect(ledger.usedEnvRate).toBe(false);
  });

  it("prefers FHIR_IMPORT_FX_RATES_JSON over built-ins", async () => {
    process.env.FHIR_IMPORT_FX_RATES_JSON = JSON.stringify({ EUR: 2 });
    const { foreignMinorToUsdCents } = await import("./fhir-fx");
    const ledger = {
      skippedNoRate: 0,
      usedEnvRate: false,
      usedBuiltinRate: false,
    };
    expect(foreignMinorToUsdCents(1000, "EUR", ledger)).toBe(2000);
    expect(ledger.usedEnvRate).toBe(true);
    expect(ledger.usedBuiltinRate).toBe(false);
  });

  it("returns null and counts skip when no rate exists", async () => {
    const { foreignMinorToUsdCents } = await import("./fhir-fx");
    const ledger = {
      skippedNoRate: 0,
      usedEnvRate: false,
      usedBuiltinRate: false,
    };
    expect(foreignMinorToUsdCents(100, "XXX", ledger)).toBeNull();
    expect(ledger.skippedNoRate).toBe(1);
  });
});

describe("resolveFhirImportFxStrict", () => {
  afterEach(() => {
    delete process.env.FHIR_IMPORT_FX_STRICT;
    vi.resetModules();
  });

  it("respects explicit override", async () => {
    process.env.FHIR_IMPORT_FX_STRICT = "true";
    const { resolveFhirImportFxStrict } = await import("./fhir-fx");
    expect(resolveFhirImportFxStrict(false)).toBe(false);
    expect(resolveFhirImportFxStrict(true)).toBe(true);
  });

  it("reads FHIR_IMPORT_FX_STRICT", async () => {
    process.env.FHIR_IMPORT_FX_STRICT = "1";
    const { resolveFhirImportFxStrict } = await import("./fhir-fx");
    expect(resolveFhirImportFxStrict()).toBe(true);
  });
});

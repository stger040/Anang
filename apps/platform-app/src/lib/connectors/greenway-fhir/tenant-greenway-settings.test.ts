import { describe, expect, it } from "vitest";

import { greenwayEnvKeySuffixForTenantSlug, resolveGreenwayFhirBaseUrlForTenant } from "./tenant-greenway-settings";

describe("greenwayEnvKeySuffixForTenantSlug", () => {
  it("normalizes slug for env keys", () => {
    expect(greenwayEnvKeySuffixForTenantSlug("lco")).toBe("LCO");
    expect(greenwayEnvKeySuffixForTenantSlug("hayward-site")).toBe("HAYWARD_SITE");
  });
});

describe("resolveGreenwayFhirBaseUrlForTenant", () => {
  it("prefers tenant baseUrl", () => {
    expect(
      resolveGreenwayFhirBaseUrlForTenant({
        tenantOverlay: { baseUrl: "https://custom.example/fhir/R4/t1" },
        globalBaseUrl: "https://global.example/base",
        fallbackHostKind: null,
      }),
    ).toBe("https://custom.example/fhir/R4/t1");
  });

  it("builds from tenant id + host", () => {
    expect(
      resolveGreenwayFhirBaseUrlForTenant({
        tenantOverlay: { fhirTenantId: "acme", hostEnv: "staging" },
        globalBaseUrl: null,
        fallbackHostKind: null,
      }),
    ).toBe(
      "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/acme",
    );
  });

  it("uses global base when overlay partial", () => {
    expect(
      resolveGreenwayFhirBaseUrlForTenant({
        tenantOverlay: null,
        globalBaseUrl: "https://global/fhir/R4/x",
        fallbackHostKind: "staging",
      }),
    ).toBe("https://global/fhir/R4/x");
  });

  it("uses fallback host kind for tenant fhirTenantId only", () => {
    expect(
      resolveGreenwayFhirBaseUrlForTenant({
        tenantOverlay: { fhirTenantId: "acme" },
        globalBaseUrl: null,
        fallbackHostKind: "production",
      }),
    ).toBe(
      "https://fhir-api.fhirprod.aws.greenwayhealth.com/fhir/R4/acme",
    );
  });
});

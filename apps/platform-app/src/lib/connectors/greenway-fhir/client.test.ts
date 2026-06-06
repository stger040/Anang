import { describe, expect, it } from "vitest";

import { greenwayFhirResolveFhirHref } from "./client";

const BASE =
  "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/acme";

describe("greenwayFhirResolveFhirHref", () => {
  it("allows absolute pagination URLs under the configured base", () => {
    expect(
      greenwayFhirResolveFhirHref(
        BASE,
        `${BASE}/Encounter?_getpages=abc&_count=50`,
      ),
    ).toBe(`${BASE}/Encounter?_getpages=abc&_count=50`);
  });

  it("allows resource-relative pagination URLs under the configured base", () => {
    expect(
      greenwayFhirResolveFhirHref(
        BASE,
        "Encounter?_getpages=abc&_count=50",
      ),
    ).toBe(`${BASE}/Encounter?_getpages=abc&_count=50`);
  });

  it("allows base-relative pagination URLs used by some FHIR servers", () => {
    expect(
      greenwayFhirResolveFhirHref(
        BASE,
        "/Encounter?_getpages=abc&_count=50",
      ),
    ).toBe(`${BASE}/Encounter?_getpages=abc&_count=50`);
  });

  it("allows origin-root pagination URLs that still point under the base", () => {
    expect(
      greenwayFhirResolveFhirHref(
        BASE,
        "/fhir/R4/acme/Encounter?_getpages=abc&_count=50",
      ),
    ).toBe(`${BASE}/Encounter?_getpages=abc&_count=50`);
  });

  it("rejects absolute pagination URLs on another host before a bearer token is sent", () => {
    expect(() =>
      greenwayFhirResolveFhirHref(
        BASE,
        "https://attacker.example/collect",
      ),
    ).toThrow("outside configured FHIR base URL");
  });

  it("rejects same-host pagination URLs outside the configured tenant base", () => {
    expect(() =>
      greenwayFhirResolveFhirHref(
        BASE,
        "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/other/Encounter",
      ),
    ).toThrow("outside configured FHIR base URL");
  });
});

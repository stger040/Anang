import { describe, expect, it } from "vitest";

import {
  greenwayFhirBaseUrl,
  greenwayFhirInstanceUrl,
  greenwayFhirTypeUrl,
} from "./urls";

describe("greenwayFhirBaseUrl", () => {
  it("builds staging base with encoded tenant", () => {
    expect(greenwayFhirBaseUrl("staging", "acme-clinic")).toBe(
      "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/acme-clinic",
    );
  });

  it("builds production base", () => {
    expect(greenwayFhirBaseUrl("production", "t1")).toBe(
      "https://fhir-api.fhirprod.aws.greenwayhealth.com/fhir/R4/t1",
    );
  });

  it("rejects empty tenant", () => {
    expect(() => greenwayFhirBaseUrl("staging", "  ")).toThrow(
      "tenant id is required",
    );
  });
});

describe("greenwayFhirTypeUrl", () => {
  it("appends resource type", () => {
    expect(
      greenwayFhirTypeUrl(
        "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/t",
        "Patient",
      ),
    ).toBe(
      "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/t/Patient",
    );
  });
});

describe("greenwayFhirInstanceUrl", () => {
  it("builds instance path", () => {
    expect(
      greenwayFhirInstanceUrl(
        "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/t",
        "Patient",
        "abc",
      ),
    ).toBe(
      "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/t/Patient/abc",
    );
  });
});

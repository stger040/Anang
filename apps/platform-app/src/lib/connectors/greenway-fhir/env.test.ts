import { afterEach, describe, expect, it } from "vitest";

import {
  readGreenwayFhirEnvConfig,
  readGreenwayFhirEnvConfigForTenant,
} from "./env";

const keys = [
  "GREENWAY_FHIR_BASE_URL",
  "GREENWAY_FHIR_TENANT_ID",
  "GREENWAY_FHIR_ENV",
  "GREENWAY_FHIR_ACCESS_TOKEN",
  "EHR_FHIR_BASE_URL",
  "EHR_FHIR_TENANT_ID",
  "EHR_FHIR_ENV",
  "EHR_FHIR_ACCESS_TOKEN",
] as const;

describe("readGreenwayFhirEnvConfig", () => {
  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  it("returns null when nothing set", () => {
    expect(readGreenwayFhirEnvConfig()).toBeNull();
  });

  it("uses explicit base URL", () => {
    process.env.GREENWAY_FHIR_BASE_URL =
      "https://example.com/fhir/R4/tenant1/";
    expect(readGreenwayFhirEnvConfig()).toEqual({
      baseUrl: "https://example.com/fhir/R4/tenant1",
      accessToken: null,
    });
  });

  it("builds base from tenant + env kind", () => {
    process.env.GREENWAY_FHIR_TENANT_ID = "acme";
    process.env.GREENWAY_FHIR_ENV = "staging";
    expect(readGreenwayFhirEnvConfig()).toEqual({
      baseUrl:
        "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/acme",
      accessToken: null,
    });
  });

  it("reads access token", () => {
    process.env.GREENWAY_FHIR_BASE_URL = "https://x/fhir/R4/t";
    process.env.GREENWAY_FHIR_ACCESS_TOKEN = "secret";
    expect(readGreenwayFhirEnvConfig()?.accessToken).toBe("secret");
  });
});

describe("readGreenwayFhirEnvConfigForTenant", () => {
  const extra = ["GREENWAY_FHIR_ACCESS_TOKEN__LCO"] as const;

  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
    for (const k of extra) {
      delete process.env[k];
    }
  });

  it("merges settings.connectors.greenwayFhir with suffixed bearer", () => {
    process.env.GREENWAY_FHIR_ACCESS_TOKEN__LCO = "tok-lco";
    const settings = {
      connectors: {
        greenwayFhir: {
          fhirTenantId: "v99",
          hostEnv: "staging",
        },
      },
    };
    expect(readGreenwayFhirEnvConfigForTenant("lco", settings)).toEqual({
      baseUrl:
        "https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/v99",
      accessToken: "tok-lco",
    });
  });
});

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  MAX_GREENWAY_CRON_PATIENT_IDS,
  parseGreenwayCronPatientIdsFromDelimitedString,
  parseGreenwayCronPatientIdsFromTenantSettings,
  resolveGreenwayCronBulkPatientIdsForTenant,
} from "./greenway-cron-allowlist";

describe("greenway-cron-allowlist", () => {
  const envKeys = [
    "GREENWAY_FHIR_CRON_PATIENT_IDS",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("dedupes and caps at MAX ids", () => {
    const many = Array.from({ length: 40 }, (_, i) => `p${i}`).join(",");
    const r = parseGreenwayCronPatientIdsFromDelimitedString(many);
    expect(r.ids.length).toBe(MAX_GREENWAY_CRON_PATIENT_IDS);
    expect(new Set(r.ids).size).toBe(r.ids.length);
  });

  it("drops invalid tokens and counts them", () => {
    const r = parseGreenwayCronPatientIdsFromDelimitedString(
      "good1, bad id, good2,, ;;; ",
    );
    expect(r.ids).toEqual(["good1", "good2"]);
    expect(r.invalidDropped).toBeGreaterThan(0);
  });

  it("parses tenant JSON array with precedence over env", () => {
    process.env.GREENWAY_FHIR_CRON_PATIENT_IDS = "env1,env2";
    const r = resolveGreenwayCronBulkPatientIdsForTenant({
      tenantSettings: {
        connectors: {
          greenwayFhir: {
            fhirTenantId: "x",
            hostEnv: "staging",
            cronSyncPatientIds: ["t1", "t2"],
          },
        },
      },
    });
    expect(r.source).toBe("tenant");
    expect(r.ids).toEqual(["t1", "t2"]);
  });

  it("falls back to env when tenant list empty", () => {
    process.env.GREENWAY_FHIR_CRON_PATIENT_IDS = "e1,e2";
    const r = resolveGreenwayCronBulkPatientIdsForTenant({
      tenantSettings: {
        connectors: {
          greenwayFhir: {
            cronSyncPatientIds: [],
          },
        },
      },
    });
    expect(r.source).toBe("env");
    expect(r.ids).toEqual(["e1", "e2"]);
  });

  it("accepts tenant cronSyncPatientIds as delimited string", () => {
    const r = parseGreenwayCronPatientIdsFromTenantSettings({
      connectors: {
        greenwayFhir: {
          cronSyncPatientIds: "a1; a2\na1",
        },
      },
    });
    expect(r.source).toBe("tenant");
    expect(r.ids).toEqual(["a1", "a2"]);
  });
});

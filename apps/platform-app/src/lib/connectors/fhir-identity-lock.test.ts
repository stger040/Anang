import { describe, expect, it, vi } from "vitest";

import {
  fhirIdentityAdvisoryLockKey,
  lockFhirIdentityInTransaction,
} from "./fhir-identity-lock";

describe("fhirIdentityAdvisoryLockKey", () => {
  it("is patient-scoped when a FHIR patient logical id is present", () => {
    expect(
      fhirIdentityAdvisoryLockKey({
        tenantId: "t1",
        fhirPatientLogicalId: " Patient/p1 ",
        fhirEncounterLogicalId: "e1",
      }),
    ).toBe("fhir-identity:v1:t1:patient:Patient/p1");
  });

  it("differs across tenants for the same patient id", () => {
    const a = fhirIdentityAdvisoryLockKey({
      tenantId: "t1",
      fhirPatientLogicalId: "p1",
    });
    const b = fhirIdentityAdvisoryLockKey({
      tenantId: "t2",
      fhirPatientLogicalId: "p1",
    });
    expect(a).not.toBe(b);
  });

  it("falls back to encounter scope when patient id is missing", () => {
    expect(
      fhirIdentityAdvisoryLockKey({
        tenantId: "t1",
        fhirPatientLogicalId: "  ",
        fhirEncounterLogicalId: "enc-9",
      }),
    ).toBe("fhir-identity:v1:t1:encounter:enc-9");
  });

  it("uses a tenant unkeyed fallback when both ids are missing", () => {
    expect(
      fhirIdentityAdvisoryLockKey({
        tenantId: " t1 ",
        fhirPatientLogicalId: null,
        fhirEncounterLogicalId: undefined,
      }),
    ).toBe("fhir-identity:v1:t1:unkeyed");
  });
});

describe("lockFhirIdentityInTransaction", () => {
  it("issues a transaction-scoped advisory lock for the identity key", async () => {
    const $executeRaw = vi.fn().mockResolvedValue(0);
    await lockFhirIdentityInTransaction(
      { $executeRaw },
      { tenantId: "t1", fhirPatientLogicalId: "p1" },
    );
    expect($executeRaw).toHaveBeenCalledTimes(1);
    const [strings, lockKey] = $executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(strings.join("")).toContain("pg_advisory_xact_lock");
    expect(strings.join("")).toContain("hashtext");
    expect(lockKey).toBe("fhir-identity:v1:t1:patient:p1");
  });
});

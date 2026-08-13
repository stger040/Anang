import { describe, expect, it, vi } from "vitest";

import {
  planImportedEncounterStatement,
  persistPatientEncounterImport,
} from "./persist-patient-encounter-import";

vi.mock("@/lib/connectors/source-artifact", () => ({
  createIngestionBatchRecordingRawPayload: vi.fn(async () => ({
    artifact: {
      id: "art-1",
      sha256Hex: "abc",
      byteLength: 12,
      storageUri: null,
    },
    inlinePayloadStored: true,
    externalStorageStored: false,
  })),
}));

vi.mock("@/lib/connectors/external-identifiers", () => ({
  findPatientIdByFhirPatientLogicalId: vi.fn(async () => null),
  findEncounterByFhirEncounterLogicalId: vi.fn(async () => null),
  recordFhirFixtureExternalIds: vi.fn(async () => undefined),
}));

describe("planImportedEncounterStatement", () => {
  it("creates on first import", () => {
    expect(
      planImportedEncounterStatement({
        existingStatementId: null,
        existingPaymentCount: 0,
        statementNumber: "FHIR-CLM-1",
      }),
    ).toEqual({ kind: "create", number: "FHIR-CLM-1" });
  });

  it("replaces an unpaid statement in place", () => {
    expect(
      planImportedEncounterStatement({
        existingStatementId: "stmt-1",
        existingPaymentCount: 0,
        statementNumber: "FHIR-CLM-1",
      }),
    ).toEqual({
      kind: "replace",
      statementId: "stmt-1",
      number: "FHIR-CLM-1",
    });
  });

  it("creates a -P statement after payments exist", () => {
    expect(
      planImportedEncounterStatement({
        existingStatementId: "stmt-1",
        existingPaymentCount: 1,
        statementNumber: "FHIR-CLM-1",
      }),
    ).toEqual({ kind: "create", number: "FHIR-CLM-1-P" });
  });
});

describe("persistPatientEncounterImport identity lock", () => {
  it("acquires the FHIR identity lock before looking up the patient", async () => {
    const order: string[] = [];
    const { findPatientIdByFhirPatientLogicalId } = await import(
      "@/lib/connectors/external-identifiers"
    );
    vi.mocked(findPatientIdByFhirPatientLogicalId).mockImplementation(
      async () => {
        order.push("patient-lookup");
        return null;
      },
    );

    const tx = {
      $executeRaw: vi.fn(async () => {
        order.push("lock");
        return 0;
      }),
      patient: {
        create: vi.fn(async () => ({ id: "pat-1" })),
      },
      encounter: {
        create: vi.fn(async () => ({ id: "enc-1" })),
      },
      statement: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: "stmt-1" })),
      },
      statementLine: {
        create: vi.fn(async () => ({ id: "line-1" })),
      },
    };

    const prisma = {
      $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
    };

    await persistPatientEncounterImport(prisma as never, {
      tenantId: "t1",
      payEnabled: true,
      normalized: {
        mrn: "MRN1",
        firstName: "Jane",
        lastName: "Doe",
        dob: null,
        dateOfService: new Date("2024-01-15T12:00:00Z"),
        chiefComplaint: null,
        visitSummary: "visit",
        fhirPatientLogicalId: "p1",
        fhirEncounterLogicalId: "e1",
      },
      rawText: "{}",
      connectorKind: "fhir_fixture",
      sourceKind: "fhir_r4_bundle_json",
      ingestMetadata: {},
      claimLines: [],
      fromClaim: false,
      statementTotalCents: 25000,
      stubStatementCents: 25000,
      stubLineDescription: "stub",
    });

    expect(order[0]).toBe("lock");
    expect(order).toContain("patient-lookup");
    expect(order.indexOf("lock")).toBeLessThan(order.indexOf("patient-lookup"));
    const [, lockKey] = tx.$executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      string,
    ];
    expect(lockKey).toBe("fhir-identity:v1:t1:patient:p1");
  });
});

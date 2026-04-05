import { describe, expect, it } from "vitest";

import {
  assemble837pProfessional,
  defaultTradingPartnerFor837p,
  type Assemble837pInput,
} from "./assemble-837p";
import {
  validateX12Structure,
  x12ValidationHasErrors,
} from "./validate-x12-structure";

describe("validateX12Structure", () => {
  it("rejects empty payload", () => {
    const v = validateX12Structure("");
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "EMPTY")).toBe(true);
  });

  it("accepts assembler 837P golden interchange", () => {
    const input: Assemble837pInput = {
      now: new Date("2026-03-29T12:00:00.000Z"),
      claimControlNumber: "GOLDEN-CLAIM-01",
      controls: { isa13: "000000001", gs06: "1", st02: "0001" },
      tradingPartner: defaultTradingPartnerFor837p(),
      patient: {
        firstName: "Jane",
        lastName: "Doe",
        mrn: "MRN123",
        dob: new Date("1975-05-15T00:00:00.000Z"),
      },
      encounter: { dateOfService: new Date("2026-03-20T00:00:00.000Z") },
      lines: [
        {
          cpt: "99213",
          icd10: "I10",
          modifier: null,
          units: 1,
          chargeCents: 150_00,
        },
      ],
      primaryCoverage: { payerName: "Test Payer", memberId: "XYZ789" },
    };
    const x12 = assemble837pProfessional(input);
    const v = validateX12Structure(x12, { expect837Professional: true });
    expect(x12ValidationHasErrors(v)).toBe(false);
    expect(v.transactionSet).toBe("837");
    expect(v.guide).toBe("837P-5010-teaching");
  });

  it("flags ISA/IEA control mismatch", () => {
    const x12 =
      "ISA*00*          *00*          *ZZ*SUB         *ZZ*REC         *260329*1200*^*00501*000000001*0*P*>~" +
      "GS*HC*A*B*20260329*120000*1*X*005010X222A1~" +
      "ST*837*0001*005010X222A1~BHT*0019*00*X*20260329*120000*CH~" +
      "CLM*X*100.00**11:B:1*Y*A*Y*Y~SE*3*0001~GE*1*1~IEA*1*000000002~";
    const v = validateX12Structure(x12, { expect837Professional: true });
    expect(v.ok).toBe(false);
    expect(v.issues.some((i) => i.code === "IEA_ISA_MISMATCH")).toBe(true);
  });

  it("flags SE declared count mismatch", () => {
    const x12 =
      "ISA*00*          *00*          *ZZ*SUB         *ZZ*REC         *260329*1200*^*00501*000000001*0*P*>~" +
      "GS*HC*A*B*20260329*120000*1*X*005010X222A1~" +
      "ST*837*0001*005010X222A1~BHT*0019*00*X*20260329*120000*CH~" +
      "CLM*X*100.00**11:B:1*Y*A*Y*Y~SE*99*0001~GE*1*1~IEA*1*000000001~";
    const v = validateX12Structure(x12);
    expect(v.issues.some((i) => i.code === "SE_COUNT_MISMATCH")).toBe(true);
  });
});

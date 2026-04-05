import { describe, expect, it } from "vitest";

import {
  assemble837pProfessional,
  defaultTradingPartnerFor837p,
  formatX12Date,
  type Assemble837pInput,
} from "./assemble-837p";

describe("formatX12Date", () => {
  it("emits CCYYMMDD in UTC", () => {
    expect(formatX12Date(new Date("2026-03-29T15:30:00.000Z"))).toBe(
      "20260329",
    );
  });
});

describe("assemble837pProfessional", () => {
  it("matches golden fixture (fixed clock and controls)", () => {
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
        {
          cpt: "93000",
          icd10: "R07.9",
          modifier: "59",
          units: 1,
          chargeCents: 75_00,
        },
      ],
      primaryCoverage: { payerName: "Test Payer", memberId: "XYZ789" },
    };

    expect(assemble837pProfessional(input)).toMatchInlineSnapshot(`"ISA*00*          *00*          *ZZ*ANANGSUBMIT    *ZZ*PAYERPLACE     *260329*1200*^*00501*000000001*0*P*>~GS*HC*ANANG*PAYER*20260329*120000*1*X*005010X222A1~ST*837*0001*005010X222A1~BHT*0019*00*GOLDEN-CLAIM-01*20260329*120000*CH~NM1*41*2*Anang Submit*****46*ANANG~NM1*40*2*Payer Receiver*****46*PAYER~HL*1**20*1~NM1*85*2*Rendering Group*****XX*1316235193~HL*2*1*22*0~SBR*P*18******CI~NM1*IL*1*Doe*Jane****MI*XYZ789~DMG*D8*19750515*U~HL*3*2*23*0~NM1*QC*1*Doe*Jane~CLM*GOLDEN-CLAIM-01*225.00***11:B:1*Y*A*Y*Y~DTP*472*D8*20260320~HI*ABK:I10*ABF:R079~LX*1~SV1*HC:99213*150.00*UN*1***1~LX*2~SV1*HC:93000:59*75.00*UN*1***1~SE*20*0001~GE*1*1~IEA*1*000000001~"`);
  });

  it("throws when there are no lines", () => {
    const input: Assemble837pInput = {
      now: new Date("2025-12-31T12:00:00.000Z"),
      claimControlNumber: "X",
      controls: { isa13: "000000001", gs06: "1", st02: "0001" },
      tradingPartner: defaultTradingPartnerFor837p(),
      patient: { firstName: "A", lastName: "B" },
      encounter: { dateOfService: new Date("2025-01-01T00:00:00.000Z") },
      lines: [],
      primaryCoverage: null,
    };
    expect(() => assemble837pProfessional(input)).toThrow(
      "at least one line",
    );
  });
});

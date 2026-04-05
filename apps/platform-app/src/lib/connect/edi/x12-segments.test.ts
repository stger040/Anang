import { describe, expect, it } from "vitest";

import {
  detectTransactionSet,
  extract835ClpFinancialContext,
  extract835ServiceLinesForClp,
  extractClpRows,
  extractFunctionalAcks837,
  extractOutbound837ControlHints,
  extractTrnReferenceIds,
  findClpSegmentIndices,
  parse835CasSegment,
  parseX12MoneyToCents,
  splitX12Segments,
  x12ControlNumbersMatch,
} from "./x12-segments";

describe("splitX12Segments", () => {
  it("splits on ~ and trims", () => {
    expect(splitX12Segments("ST*277*1~\nCLP*ABC*3~")).toEqual([
      "ST*277*1",
      "CLP*ABC*3",
    ]);
  });
});

describe("detectTransactionSet", () => {
  it("detects 277", () => {
    expect(detectTransactionSet(["ISA*...", "ST*277*1"])).toBe("277");
  });
  it("detects 835", () => {
    expect(detectTransactionSet(["ST*835*1"])).toBe("835");
  });
  it("detects 997", () => {
    expect(detectTransactionSet(["ST*997*1"])).toBe("997");
  });
  it("detects 999", () => {
    expect(detectTransactionSet(["ST*999*1"])).toBe("999");
  });
});

describe("extractOutbound837ControlHints", () => {
  it("reads ISA13, GS06, ST02 from assembled-style segments", () => {
    const raw =
      "ISA*00*          *00*          *ZZ*SUB*ZZ*REC*260329*1200*^*00501*999888777*0*P*:~" +
      "GS*HC*A*B*20260329*120000*42*X*005010X222A1~" +
      "ST*837*0007*005010X222A1~";
    const segs = splitX12Segments(raw);
    expect(extractOutbound837ControlHints(segs)).toEqual({
      interchangeControlNumber: "999888777",
      groupControlNumber: "42",
      transactionSetControlNumber: "0007",
    });
  });
});

describe("extractFunctionalAcks837", () => {
  it("pairs AK2 837 with AK5 under AK1 group", () => {
    const segs = splitX12Segments(
      "ST*997*1*005010X231~AK1*HC*42*A~AK2*837*0007~AK5*A~SE*4*1~",
    );
    expect(extractFunctionalAcks837(segs)).toEqual([
      { groupControl: "42", stControl: "0007", ak5Code: "A" },
    ]);
  });
});

describe("x12ControlNumbersMatch", () => {
  it("ignores leading zeros", () => {
    expect(x12ControlNumbersMatch("0007", "7")).toBe(true);
    expect(x12ControlNumbersMatch("0007", "8")).toBe(false);
  });
});

describe("extractClpRows", () => {
  it("parses CLP with payment slot", () => {
    const rows = extractClpRows(["CLP*CLM-1*1*100.00*80.00*"]);
    expect(rows).toEqual([
      {
        submitterClaimId: "CLM-1",
        statusCode: "1",
        totalChargeAmount: "100.00",
        claimPaymentAmount: "80.00",
      },
    ]);
  });
});

describe("extractTrnReferenceIds", () => {
  it("collects TRN02 values", () => {
    expect(
      extractTrnReferenceIds(["TRN*1*CHK987*REFCO", "TRN*2*PAY555"]),
    ).toEqual(["CHK987", "PAY555"]);
  });
  it("dedupes", () => {
    expect(
      extractTrnReferenceIds(["TRN*1*X", "TRN*1*X", "TRN*1*Y"]),
    ).toEqual(["X", "Y"]);
  });
});

describe("parseX12MoneyToCents", () => {
  it("converts dollars to cents", () => {
    expect(parseX12MoneyToCents("872.00")).toBe(87200);
  });
  it("returns null for empty", () => {
    expect(parseX12MoneyToCents("")).toBeNull();
  });
});

describe("835 SVC / CAS / LQ per CLP", () => {
  it("findClpSegmentIndices matches extractClpRows length", () => {
    const raw =
      "ST*835*0001~CLP*A*1*200*150~SVC*HC:99213*100*80~CAS*CO*45*20~LQ*HE*N123~SVC*HC:99214*100*70~SE*99*0001~";
    const segs = splitX12Segments(raw);
    expect(findClpSegmentIndices(segs)).toEqual([1]);
    expect(extractClpRows(segs).length).toBe(1);
  });

  it("extract835ServiceLinesForClp captures multi-CAS, LQ HE RARC, rollups per SVC", () => {
    const raw =
      "ST*835*1~CLP*CLM99*1*200*150~SVC*HC:93000*120*90~CAS*CO*50*30~LQ*HE*M15~SVC*AD:D1234*80*60~CAS*PR*96*20~SE*9*1~";
    const segs = splitX12Segments(raw);
    const idx = findClpSegmentIndices(segs)[0]!;
    const lines = extract835ServiceLinesForClp(segs, idx, {
      billedCents: 20000,
      paidCents: 15000,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]!.procedureCode).toBe("93000");
    expect(lines[0]!.lineBilledCents).toBe(12000);
    expect(lines[0]!.linePaidCents).toBe(9000);
    expect(lines[0]!.carcCode).toBe("50");
    expect(lines[0]!.rarcCodes).toEqual(["M15"]);
    expect(lines[0]!.adjustments).toHaveLength(1);
    expect(lines[0]!.adjustments[0]).toMatchObject({
      claimAdjustmentGroupCode: "CO",
      carcCode: "50",
      adjustmentAmountCents: 3000,
      rarcCodes: ["M15"],
    });
    expect(lines[0]!.lineAllowedCents).toBe(9000);

    expect(lines[1]!.procedureCode).toBe("D1234");
    expect(lines[1]!.adjustments[0]!.claimAdjustmentGroupCode).toBe("PR");
    expect(lines[1]!.patientResponsibilityCents).toBe(2000);
  });

  it("parse835CasSegment expands repeated reason/amount tuples in one CAS", () => {
    const rows = parse835CasSegment("CAS*CO*45*10*1*50*20*1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      claimAdjustmentGroupCode: "CO",
      carcCode: "45",
      adjustmentAmountCents: 1000,
    });
    expect(rows[1]).toMatchObject({
      carcCode: "50",
      adjustmentAmountCents: 2000,
    });
  });

  it("claim-level loop (no SVC) uses CLP amounts and still parses CAS", () => {
    const raw = "ST*835*1~CLP*Z*1*100*80~CAS*CO*2*15~~SE*2*1~";
    const segs = splitX12Segments(raw);
    const idx = findClpSegmentIndices(segs)[0]!;
    const lines = extract835ServiceLinesForClp(segs, idx, {
      billedCents: 10000,
      paidCents: 8000,
    });
    expect(lines).toHaveLength(1);
    expect(lines[0]!.procedureCode).toBeNull();
    expect(lines[0]!.lineBilledCents).toBe(10000);
    expect(lines[0]!.adjustments).toHaveLength(1);
    expect(lines[0]!.adjustments[0]!.carcCode).toBe("2");
  });

  it("extract835ClpFinancialContext reads MIA/MOA before first SVC", () => {
    const inner = splitX12Segments(
      "MIA*0*1*2~MOA*MA01~SVC*HC:99213*50*40~SE*1~",
    );
    const ctx = extract835ClpFinancialContext(inner);
    expect(ctx.miaSegments.some((s) => s.startsWith("MIA*"))).toBe(true);
    expect(ctx.moaSegments.some((s) => s.startsWith("MOA*"))).toBe(true);
  });

  it("AMT qualified segment lifts line allowed when present", () => {
    const raw =
      "ST*835*1~CLP*Q*1*50*40~SVC*HC:93000*100*80~AMT*AA*75~SE*9*1~";
    const segs = splitX12Segments(raw);
    const idx = findClpSegmentIndices(segs)[0]!;
    const lines = extract835ServiceLinesForClp(segs, idx, {
      billedCents: 5000,
      paidCents: 4000,
    });
    expect(lines[0]!.lineAllowedCents).toBe(7500);
    expect(lines[0]!.amtSegments.some((a) => a.qualifier === "AA")).toBe(true);
  });
});

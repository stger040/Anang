import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { inbound835RemittanceKey } from "./apply-inbound-x12";

describe("inbound835RemittanceKey", () => {
  it("uses a stable payload hash instead of delivery-specific ingestion batch ids", () => {
    const x12 =
      "ISA*00*          *00*          *ZZ*SENDER         *ZZ*RECEIVER       *260613*1100*^*00501*000000001*0*T*:~GS*HP*SENDER*RECEIVER*20260613*1100*1*X*005010X221A1~ST*835*0001~BPR*I*10*C*CHK************20260613~TRN*1*TRACE-1~CLP*CLAIM-1*1*100*10**12*PAYERCTRL~SE*6*0001~GE*1*1~IEA*1*000000001~";
    const expectedHash = createHash("sha256")
      .update(x12, "utf8")
      .digest("hex")
      .slice(0, 32);

    expect(inbound835RemittanceKey(x12)).toBe(`edi835:sha:${expectedHash}`);
    expect(inbound835RemittanceKey(x12)).toBe(inbound835RemittanceKey(x12));
    expect(inbound835RemittanceKey(x12)).not.toContain("batch");
  });
});

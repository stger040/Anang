import { describe, expect, it } from "vitest";

import { detectNcpdpClaimAsciiHint } from "./ncpdp-claim-hints";

describe("detectNcpdpClaimAsciiHint", () => {
  it("returns unknown for empty or short input", () => {
    expect(detectNcpdpClaimAsciiHint("")).toBe("unknown");
    expect(detectNcpdpClaimAsciiHint("short")).toBe("unknown");
  });

  it("detects teleclaim-style AM01 segment", () => {
    const raw =
      "HD*...~AM01*SEQ*01*20260101*1234567890~...~";
    expect(detectNcpdpClaimAsciiHint(raw)).toBe("teleclaim_line_ascii_hint");
  });

  it("detects D2 with segment-style prefix", () => {
    const raw = "B1*A*1~*D2*010101*RX123~";
    expect(detectNcpdpClaimAsciiHint(raw)).toBe("teleclaim_line_ascii_hint");
  });

  it("returns unknown for arbitrary text", () => {
    expect(detectNcpdpClaimAsciiHint("ISA*00*…")).toBe("unknown");
  });
});

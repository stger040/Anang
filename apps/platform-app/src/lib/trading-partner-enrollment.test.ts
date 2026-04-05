import { describe, expect, it } from "vitest";

import {
  readTradingPartnerEnrollmentFromForm,
  tradingPartnerEnrollmentHasContent,
} from "./trading-partner-enrollment";

describe("tradingPartnerEnrollmentHasContent", () => {
  it("is false for empty test draft", () => {
    expect(
      tradingPartnerEnrollmentHasContent({
        environment: "test",
      }),
    ).toBe(false);
  });

  it("is true when interchange flag set", () => {
    expect(
      tradingPartnerEnrollmentHasContent({
        environment: "test",
        interchangeEnrollmentComplete: true,
      }),
    ).toBe(true);
  });
});

describe("readTradingPartnerEnrollmentFromForm", () => {
  it("maps other + custom string", () => {
    const fd = new FormData();
    fd.set("tp_clearinghouseKey", "other");
    fd.set("tp_clearinghouseOther", "My CH");
    fd.set("tp_environment", "test");
    fd.set("tp_isaSenderId", "ZZZ");
    const tp = readTradingPartnerEnrollmentFromForm(fd);
    expect(tp?.clearinghouseKey).toBe("My CH");
    expect(tp?.isaSenderId).toBe("ZZZ");
  });

  it("returns undefined when nothing meaningful", () => {
    const fd = new FormData();
    fd.set("tp_environment", "test");
    expect(readTradingPartnerEnrollmentFromForm(fd)).toBeUndefined();
  });
});

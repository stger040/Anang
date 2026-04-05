import {
  createPatientPayToken,
  verifyPatientPayToken,
  verifyPatientPayTokenDetailed,
} from "@/lib/patient-pay-token";
import { afterEach, describe, expect, it } from "vitest";

describe("patient-pay-token", () => {
  afterEach(() => {
    delete process.env.PATIENT_PAY_LINK_SECRET;
    delete process.env.AUTH_SECRET;
  });

  it("roundtrips when PATIENT_PAY_LINK_SECRET is set", () => {
    process.env.PATIENT_PAY_LINK_SECRET = "unit-test-secret-at-least-32-bytes!!";
    const t = createPatientPayToken({
      orgSlug: "demo",
      statementId: "stmt_1",
      ttlSec: 120,
    });
    expect(verifyPatientPayToken(t)).toEqual({
      orgSlug: "demo",
      statementId: "stmt_1",
    });
  });

  it("rejects tampered token", () => {
    process.env.PATIENT_PAY_LINK_SECRET = "unit-test-secret-at-least-32-bytes!!";
    const t = createPatientPayToken({
      orgSlug: "demo",
      statementId: "stmt_1",
      ttlSec: 120,
    });
    const broken = t.slice(0, -2) + "xx";
    expect(verifyPatientPayToken(broken)).toBeNull();
  });

  it("rejects expired token", async () => {
    process.env.PATIENT_PAY_LINK_SECRET = "unit-test-secret-at-least-32-bytes!!";
    const t = createPatientPayToken({
      orgSlug: "demo",
      statementId: "stmt_1",
      ttlSec: 1,
    });
    // exp is whole seconds; wait past the next second boundary.
    await new Promise((r) => setTimeout(r, 2500));
    expect(verifyPatientPayToken(t)).toBeNull();
  });

  it("detailed verify reports expired vs wrong_org", async () => {
    process.env.PATIENT_PAY_LINK_SECRET = "unit-test-secret-at-least-32-bytes!!";
    const t = createPatientPayToken({
      orgSlug: "demo",
      statementId: "stmt_1",
      ttlSec: 120,
    });
    expect(verifyPatientPayTokenDetailed(t, "other")).toEqual({
      ok: false,
      reason: "wrong_org",
    });
    expect(verifyPatientPayTokenDetailed(t, "demo")).toMatchObject({
      ok: true,
      payload: { orgSlug: "demo", statementId: "stmt_1" },
    });

    const short = createPatientPayToken({
      orgSlug: "demo",
      statementId: "stmt_1",
      ttlSec: 1,
    });
    await new Promise((r) => setTimeout(r, 2500));
    expect(verifyPatientPayTokenDetailed(short, "demo")).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});

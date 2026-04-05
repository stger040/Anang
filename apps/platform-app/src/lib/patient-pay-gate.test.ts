import {
  patientMatchesVerificationFactors,
  signPatientPayGateCookie,
  verifyPatientPayGateCookie,
} from "@/lib/patient-pay-gate";
import { afterEach, describe, expect, it } from "vitest";

describe("patient-pay-gate", () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.PATIENT_PAY_LINK_SECRET;
    delete process.env.DISABLE_PATIENT_PAY_STEPUP;
  });

  it("cookie verifies for same token", () => {
    process.env.AUTH_SECRET = "test-auth-secret-for-gate-cookie!!";
    const token = "magic-link-payload";
    const c = signPatientPayGateCookie(token);
    expect(c).toBeTruthy();
    expect(verifyPatientPayGateCookie(c!, token)).toBe(true);
    expect(verifyPatientPayGateCookie(c!, "other")).toBe(false);
  });

  it("matches DOB", () => {
    const dob = new Date(Date.UTC(1990, 5, 15));
    expect(
      patientMatchesVerificationFactors({
        dob,
        mrn: "syn-1234567890",
        dobInput: "1990-06-15",
        accountLast4Input: undefined,
      }),
    ).toBe(true);
    expect(
      patientMatchesVerificationFactors({
        dob,
        mrn: "syn-1234567890",
        dobInput: "1990-06-14",
        accountLast4Input: undefined,
      }),
    ).toBe(false);
  });

  it("matches account last 4 from MRN digits", () => {
    expect(
      patientMatchesVerificationFactors({
        dob: null,
        mrn: "syn-1045974580",
        dobInput: undefined,
        accountLast4Input: "4580",
      }),
    ).toBe(true);
    expect(
      patientMatchesVerificationFactors({
        dob: null,
        mrn: "syn-1045974580",
        dobInput: undefined,
        accountLast4Input: "4581",
      }),
    ).toBe(false);
  });
});

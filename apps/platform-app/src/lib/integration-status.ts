/**
 * What the running app knows about “real world” integrations (no keys committed).
 * All `not_configured` until you add env vars and wire workers.
 */

export type IntegrationLane = "mock" | "not_configured" | "test_ready" | "live";

export type IntegrationStatusPayload = {
  dataSource: { lane: IntegrationLane; detail: string };
  payments: { lane: IntegrationLane; detail: string };
  outboundComms: { lane: IntegrationLane; detail: string };
  clearinghouse: { lane: IntegrationLane; detail: string };
};

function lane(
  testReady: boolean,
  live: boolean,
  mockDetail: string,
): { lane: IntegrationLane; detail: string } {
  if (live) return { lane: "live", detail: "Production credentials detected (verify before demos)." };
  if (testReady) return { lane: "test_ready", detail: "Test/sandbox credentials present." };
  return { lane: "not_configured", detail: mockDetail };
}

/** Readable by server components and API routes — never logs secrets. */
export function getIntegrationStatus(): IntegrationStatusPayload {
  const stripe = !!process.env.STRIPE_SECRET_KEY?.trim();
  const twilioSid = !!process.env.TWILIO_ACCOUNT_SID?.trim();
  const sendgrid = !!process.env.SENDGRID_API_KEY?.trim();
  const resend = !!process.env.RESEND_API_KEY?.trim();
  const clearinghouse = !!process.env.CLEARINGHOUSE_API_KEY?.trim();
  const ehrClientId = !!process.env.EHR_FHIR_CLIENT_ID?.trim();

  const commsReady = twilioSid || sendgrid || resend;

  return {
    dataSource: ehrClientId
      ? {
          lane: "test_ready",
          detail: "FHIR client id present — connect worker/UI next.",
        }
      : {
          lane: "mock",
          detail:
            "Prisma seed / synthetic tenants only. See prisma/seed.ts and docs/EPIC_AND_TEST_DATA.md.",
        },
    payments: lane(
      stripe,
      process.env.ANANG_PAYMENTS_LIVE === "1" && stripe,
      "Add STRIPE_SECRET_KEY (test mode recommended) before wiring Pay checkout.",
    ),
    outboundComms: lane(
      commsReady,
      false,
      "Optional: TWILIO_ACCOUNT_SID, SENDGRID_API_KEY, or RESEND_API_KEY for SMS/email.",
    ),
    clearinghouse: clearinghouse
      ? { lane: "test_ready", detail: "Clearinghouse API key present — wire submit workers." }
      : {
          lane: "not_configured",
          detail: "Connect module uses seeded claims until CLEARINGHOUSE_* env and partner enrollment.",
        },
  };
}

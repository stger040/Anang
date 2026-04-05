/**
 * What the running app knows about “real world” integrations (no keys committed).
 * All `not_configured` until you add env vars and wire workers.
 */

import {
  isOpenAiBillExplainDisabled,
  isOpenAiBillExplainMinimalPayload,
} from "@/lib/bill-line-explain";
import { isNcpdpConnectorScaffoldEnabled } from "@/lib/connect/ncpdp/ncpdp-claim-hints";
import {
  isGreenwayFhirClientCredentialsConfigured,
  readGreenwayFhirEnvConfig,
} from "@/lib/connectors/greenway-fhir";
import { resolveFhirImportFxStrict } from "@/lib/fhir-fx";

/** Deployment posture: `local` = built-in fallbacks / no external vendor yet for that slice. */
export type IntegrationLane =
  | "local"
  | "not_configured"
  | "test_ready"
  | "live";

export type IntegrationStatusPayload = {
  dataSource: { lane: IntegrationLane; detail: string };
  /**
   * Paste R4 Bundle under Implementation hub — FX env affects Pay line conversion.
   * **`exampleBundlePath`** is relative to **`apps/platform-app`**.
   */
  fhirFixtureImport: {
    lane: IntegrationLane;
    detail: string;
    exampleBundlePath: string;
  };
  /** Pay statement “Explain charge” — OpenAI vs template (**IMPLEMENTATION_PLAN** Medical AI 1.0). */
  medicalAiBillExplain: { lane: IntegrationLane; detail: string };
  payments: { lane: IntegrationLane; detail: string };
  outboundComms: { lane: IntegrationLane; detail: string };
  clearinghouse: { lane: IntegrationLane; detail: string };
  /** Pharmacy / NCPDP parallel path (optional SKU, E2b2b6). */
  pharmacyClaims: { lane: IntegrationLane; detail: string };
  /** Greenway / Intergy FHIR R4 — pilot 1 (env in apps/platform-app). */
  greenwayFhir: { lane: IntegrationLane; detail: string };
  /** Epic / SMART — pilot 2 planning only until App Orchard + BAA. */
  epicFhir: { lane: IntegrationLane; detail: string };
};

function lane(
  testReady: boolean,
  live: boolean,
  fallbackDetail: string,
): { lane: IntegrationLane; detail: string } {
  if (live)
    return {
      lane: "live",
      detail:
        "Production credentials detected — verify before customer go-live.",
    };
  if (testReady)
    return {
      lane: "test_ready",
      detail: "Test/sandbox credentials present.",
    };
  return { lane: "not_configured", detail: fallbackDetail };
}

/** Readable by server components and API routes — never logs secrets. */
export function getIntegrationStatus(): IntegrationStatusPayload {
  const stripe = !!process.env.STRIPE_SECRET_KEY?.trim();
  const twilioSid = !!process.env.TWILIO_ACCOUNT_SID?.trim();
  const sendgrid = !!process.env.SENDGRID_API_KEY?.trim();
  const resend = !!process.env.RESEND_API_KEY?.trim();
  const clearinghouse = !!process.env.CLEARINGHOUSE_API_KEY?.trim();
  const ehrClientId = !!process.env.EHR_FHIR_CLIENT_ID?.trim();
  const fhirFxRates = !!process.env.FHIR_IMPORT_FX_RATES_JSON?.trim();
  const fhirFxStrict = resolveFhirImportFxStrict();

  const commsReady = twilioSid || sendgrid || resend;

  const fhirFixtureParts = [
    "R4 Bundle paste and CSV v1 grid (Settings → Implementation) → same canonical Patient / Encounter / Statement path.",
    fhirFxStrict
      ? "FX strict on — imports fail if a foreign line has no rate (FHIR_IMPORT_FX_STRICT)."
      : null,
    fhirFxRates
      ? "Custom FX overrides configured (FHIR_IMPORT_FX_RATES_JSON)."
      : "FX: optional built-in reference rates unless you set FHIR_IMPORT_FX_RATES_JSON.",
  ].filter((s): s is string => typeof s === "string");

  const fhirFixtureDetail = fhirFixtureParts.join(" ");
  const openaiKey = !!process.env.OPENAI_API_KEY?.trim();
  const explainDisabled = isOpenAiBillExplainDisabled();
  const explainMinimal = isOpenAiBillExplainMinimalPayload();

  const gwCfg = readGreenwayFhirEnvConfig();
  const gwHasBase = Boolean(gwCfg?.baseUrl);
  const gwHasAuth =
    Boolean(gwCfg?.accessToken) ||
    isGreenwayFhirClientCredentialsConfigured();
  const greenwayFhir = gwHasBase && gwHasAuth
    ? {
        lane: "test_ready" as const,
        detail:
          "Greenway FHIR base plus auth (global or __SLUG env) — Implementation hub test/sync and cron can reach the API; optional Tenant.settings connectors.greenwayFhir for per-org base.",
      }
    : gwHasBase
      ? {
          lane: "not_configured" as const,
          detail:
            "Greenway FHIR base is set but no bearer token or OAuth trio (GREENWAY_FHIR_CLIENT_ID / CLIENT_SECRET / TOKEN_URL).",
        }
      : {
          lane: "local" as const,
          detail:
            "Pilot 1 EHR feed — configure when ready; see docs/PILOT_CONNECTOR_ROADMAP.md.",
        };

  const epicFhir = {
    lane: "local" as const,
    detail:
      "Second pilot wave (e.g. Tamarack Health / Epic): App Orchard + SMART — docs/EPIC_FHIR_INTEGRATION_PLAN.md. No Epic HTTP connector ships until credentials exist.",
  };

  const medicalAiBillExplain = (() => {
    if (explainDisabled) {
      return {
        lane: "local" as const,
        detail:
          "OPENAI_DISABLE_BILL_EXPLAIN — external LLM disabled; template-only. Prefer for HIPAA-covered workloads without a BAA on inference.",
      };
    }
    if (!openaiKey) {
      return {
        lane: "local" as const,
        detail:
          "Add OPENAI_API_KEY for AI-assisted “Explain charge”; otherwise template only. For production PHI, prefer BAA-covered inference (e.g. Azure OpenAI) or keep disabled.",
      };
    }
    const parts = [
      "OPENAI_API_KEY set — Pay “Explain charge” may call OpenAI.",
      "Do not send real PHI on consumer API without compliance review; use OPENAI_DISABLE_BILL_EXPLAIN=1 or minimal payload.",
    ];
    if (explainMinimal) {
      parts.push("OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD — code + amount only to the model.");
    } else {
      parts.push(
        "Set OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD=1 to omit charge description text from API requests.",
      );
    }
    return { lane: "test_ready" as const, detail: parts.join(" ") };
  })();

  return {
    dataSource: ehrClientId
      ? {
          lane: "test_ready",
          detail: "FHIR client id present — connect worker/UI next.",
        }
      : {
          lane: "local",
          detail:
            "No EHR client id yet — use Implementation hub imports or wire a live feed when ready. See docs/EPIC_AND_TEST_DATA.md.",
        },
    fhirFixtureImport: {
      lane: fhirFxStrict || fhirFxRates ? "test_ready" : "local",
      detail: fhirFixtureDetail,
      exampleBundlePath: "fixtures/fhir/minimal-patient-encounter-claim.example.json",
    },
    medicalAiBillExplain,
    payments: lane(
      stripe,
      process.env.ANANG_PAYMENTS_LIVE === "1" && stripe,
      "Add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET (test mode) for Pay checkout and posting.",
    ),
    outboundComms: lane(
      commsReady,
      false,
      "Optional: TWILIO_ACCOUNT_SID, SENDGRID_API_KEY, or RESEND_API_KEY for SMS/email.",
    ),
    clearinghouse: clearinghouse
      ? {
          lane: "test_ready",
          detail:
            "Clearinghouse API key present — wire submission and remittance workers next.",
        }
      : {
          lane: "not_configured",
          detail:
            "Clearinghouse enrollment and 837/277/835 integration not configured for this deploy.",
        },
    pharmacyClaims: isNcpdpConnectorScaffoldEnabled()
      ? {
          lane: "test_ready",
          detail:
            "NCPDP_CONNECTOR_ENABLED — `ncpdp_pharmacy` connector kind + format hints scaffold live; full Teleclaim/SCRIPT parsers and webhooks are contract-gated (docs/CONNECTOR_STRATEGY.md Appendix B).",
        }
      : {
          lane: "local",
          detail:
            "Pharmacy e-claims not enabled — medical X12 Connect path only unless a contract adds NCPDP. Set NCPDP_CONNECTOR_ENABLED=1 to surface scaffold status and use `ConnectorKind.ncpdp_pharmacy` in future ingest code.",
        },
    greenwayFhir,
    epicFhir,
  };
}

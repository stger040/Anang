/**
 * First-pilot onboarding (weeks 1–3): billing discovery + IT / EHR alignment.
 * Labels are stable; completion state lives in Tenant.settings.implementation.
 */

export const BILLING_DISCOVERY_ITEMS = [
  {
    id: "statement_source",
    label:
      "Systems of record for statements / patient balance (PM, EHR pat fin, collection agency feed)",
  },
  {
    id: "charge_lag",
    label: "Typical lag from DOS → charges posted (drives statement timing expectations)",
  },
  {
    id: "payer_mix",
    label: "Payer mix, self-pay %, and common denial / underpay themes",
  },
  {
    id: "payment_plans",
    label: "Existing payment plan / financing policy and approval path",
  },
  {
    id: "staffing",
    label: "Billing / patient financial staffing model and escalation owners",
  },
  {
    id: "pci_clearinghouse",
    label: "Current gateway, clearinghouse, and PCI posture (who touches card data today)",
  },
] as const;

export const IT_EHR_WORKSTREAM_ITEMS = [
  {
    id: "baa_vendor_contacts",
    label: "BAA status + vendor / IT contacts for PHI systems",
  },
  {
    id: "integration_pattern",
    label: "Preferred integration pattern (FHIR R4, HL7 v2, vendor API, batch extract)",
  },
  {
    id: "network_vpn",
    label: "Network path plan (VPN, allowlists, non-prod → prod promotion)",
  },
  {
    id: "sandbox_access",
    label: "Test environment access schedule (aligned to contract)",
  },
  {
    id: "idp_sso",
    label: "Identity provider (SSO / MFA) expectations for staff and admins",
  },
  {
    id: "phi_test_data",
    label: "PHI-free or de-ID test dataset agreement until production feed",
  },
] as const;

export type ChecklistFamily = "billing" | "it";

export type OnboardingCheckState = Record<string, boolean>;

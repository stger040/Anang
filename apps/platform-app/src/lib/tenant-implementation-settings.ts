import type { OnboardingCheckState } from "./onboarding-checklists";
import {
  defaultPriorAuthImplementationSettings,
  parsePriorAuthImplementationSettings,
  type PriorAuthImplementationSettingsV1,
} from "./prior-auth/defaults";
import type { TradingPartnerEnrollmentV1 } from "./trading-partner-enrollment";
import { parseTradingPartnerEnrollment } from "./trading-partner-enrollment";

/** Versioned block stored at Tenant.settings.implementation */
export type TenantImplementationSettingsV1 = {
  version: 1;
  /** Target go-live or checkpoint notes (free text) */
  milestoneNotes?: string;
  /** e.g. Dentrix Enterprise, Epic, athena, unknown */
  ehrVendor?: string;
  /** Interface reality: FHIR, HL7, API, file, TBD */
  integrationPattern?: string;
  /** Clearinghouse / EDI enrollment (operational metadata — not PHI). */
  tradingPartnerEnrollment?: TradingPartnerEnrollmentV1;
  contacts?: {
    itName?: string;
    itEmail?: string;
    billingLeadName?: string;
    billingLeadEmail?: string;
  };
  checklist?: {
    billing: OnboardingCheckState;
    it: OnboardingCheckState;
  };
  /** Medical-benefit prior auth (Connect Phase 1) — not pharmacy ePA. */
  priorAuth?: PriorAuthImplementationSettingsV1;
};

export function parseImplementationSettings(
  raw: unknown,
): TenantImplementationSettingsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const tp = parseTradingPartnerEnrollment(o.tradingPartnerEnrollment);
  const parsed = { ...(raw as object) } as TenantImplementationSettingsV1;
  const rec = parsed as Record<string, unknown>;
  delete rec.tradingPartnerEnrollment;
  if (tp) {
    parsed.tradingPartnerEnrollment = tp;
  }
  const pa = parsePriorAuthImplementationSettings(o.priorAuth);
  if (pa) {
    parsed.priorAuth = pa;
  }
  return parsed;
}

export function defaultImplementationV1(): TenantImplementationSettingsV1 {
  return {
    version: 1,
    checklist: { billing: {}, it: {} },
    priorAuth: defaultPriorAuthImplementationSettings(),
  };
}

export function mergeImplementationFromForm(args: {
  existing: unknown;
  milestoneNotes: string;
  ehrVendor: string;
  integrationPattern: string;
  contacts: TenantImplementationSettingsV1["contacts"];
  billing: OnboardingCheckState;
  it: OnboardingCheckState;
  tradingPartnerEnrollment: TradingPartnerEnrollmentV1 | undefined;
  priorAuth: PriorAuthImplementationSettingsV1;
}): TenantImplementationSettingsV1 {
  const core = {
    version: 1 as const,
    milestoneNotes: args.milestoneNotes || undefined,
    ehrVendor: args.ehrVendor || undefined,
    integrationPattern: args.integrationPattern || undefined,
    contacts: args.contacts,
    checklist: {
      billing: args.billing,
      it: args.it,
    },
    priorAuth: args.priorAuth,
  };
  return args.tradingPartnerEnrollment
    ? {
        ...core,
        tradingPartnerEnrollment: args.tradingPartnerEnrollment,
      }
    : core;
}

import type { UnknownPlanBehavior } from "./types";

export type PriorAuthSignalCategoryKey =
  | "advanced_imaging"
  | "outpatient_surgery_context"
  | "infusion"
  | "dme"
  | "sleep_study"
  | "therapy_units_threshold";

/** Stored under `Tenant.settings.implementation.priorAuth` (versioned block). */
export type PriorAuthImplementationSettingsV1 = {
  version: 1;
  enabled: boolean;
  /** Phase 1: medical benefit prior auth only (not pharmacy ePA). */
  scope: "medical_benefit_only";
  unknownPlanBehavior: UnknownPlanBehavior;
  /** High-risk categories enabled for deterministic detection (subset of internal keys). */
  defaultHighRiskCategories: PriorAuthSignalCategoryKey[];
  /** Hours from case creation / intake before SLA clock starts (intake buffer). */
  intakeStartHours: number;
  standardDecisionSlaDays: number;
  expeditedDecisionSlaHours: number;
  followUpIntervalHours: number;
  expiringSoonDays: number;
  reworkTrackingFields: string[];
  laborRateCentsPerHour: number | null;
};

export const DEFAULT_PRIOR_AUTH_HIGH_RISK: PriorAuthSignalCategoryKey[] = [
  "advanced_imaging",
  "outpatient_surgery_context",
  "infusion",
  "dme",
  "sleep_study",
  "therapy_units_threshold",
];

export function defaultPriorAuthImplementationSettings(): PriorAuthImplementationSettingsV1 {
  return {
    version: 1,
    enabled: true,
    scope: "medical_benefit_only",
    unknownPlanBehavior: "review_required",
    defaultHighRiskCategories: [...DEFAULT_PRIOR_AUTH_HIGH_RISK],
    intakeStartHours: 24,
    standardDecisionSlaDays: 14,
    expeditedDecisionSlaHours: 72,
    followUpIntervalHours: 48,
    expiringSoonDays: 14,
    reworkTrackingFields: ["denialReason", "resubmissionCount"],
    laborRateCentsPerHour: null,
  };
}

export function parsePriorAuthImplementationSettings(
  raw: unknown,
): PriorAuthImplementationSettingsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const enabled = Boolean(o.enabled);
  const scope = o.scope === "medical_benefit_only" ? "medical_benefit_only" : null;
  if (!scope) return null;
  const unknownPlanBehavior =
    o.unknownPlanBehavior === "proceed_low_risk" ? "proceed_low_risk" : "review_required";
  const cats = Array.isArray(o.defaultHighRiskCategories)
    ? (o.defaultHighRiskCategories as unknown[]).filter(
        (x): x is PriorAuthSignalCategoryKey =>
          typeof x === "string" &&
          DEFAULT_PRIOR_AUTH_HIGH_RISK.includes(x as PriorAuthSignalCategoryKey),
      )
    : [...DEFAULT_PRIOR_AUTH_HIGH_RISK];
  return {
    version: 1,
    enabled,
    scope,
    unknownPlanBehavior,
    defaultHighRiskCategories: cats.length ? cats : [...DEFAULT_PRIOR_AUTH_HIGH_RISK],
    intakeStartHours: num(o.intakeStartHours, 24),
    standardDecisionSlaDays: num(o.standardDecisionSlaDays, 14),
    expeditedDecisionSlaHours: num(o.expeditedDecisionSlaHours, 72),
    followUpIntervalHours: num(o.followUpIntervalHours, 48),
    expiringSoonDays: num(o.expiringSoonDays, 14),
    reworkTrackingFields: Array.isArray(o.reworkTrackingFields)
      ? (o.reworkTrackingFields as unknown[]).filter((x): x is string => typeof x === "string")
      : ["denialReason", "resubmissionCount"],
    laborRateCentsPerHour:
      o.laborRateCentsPerHour == null
        ? null
        : typeof o.laborRateCentsPerHour === "number" && Number.isFinite(o.laborRateCentsPerHour)
          ? Math.round(o.laborRateCentsPerHour)
          : null,
  };
}

function num(v: unknown, d: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return d;
  return Math.round(v);
}

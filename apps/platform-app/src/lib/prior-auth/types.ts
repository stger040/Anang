import type {
  Coverage,
  Encounter,
  PriorAuthChecklistStatus,
  PriorAuthServiceCodeType,
  PriorAuthStatus,
  PriorAuthSubmissionMethod,
  PriorAuthUrgency,
} from "@prisma/client";

export type {
  PriorAuthChecklistStatus,
  PriorAuthServiceCodeType,
  PriorAuthStatus,
  PriorAuthSubmissionMethod,
  PriorAuthUrgency,
};

export type PriorAuthSignalCategory =
  | "advanced_imaging"
  | "outpatient_surgery_context"
  | "infusion"
  | "dme"
  | "sleep_study"
  | "therapy_units_threshold";

export type PriorAuthSignal = {
  category: PriorAuthSignalCategory;
  /** CPT / HCPCS that triggered the signal (normalized upper). */
  codes: string[];
  rationale: string;
};

export type UnknownPlanBehavior = "review_required" | "proceed_low_risk";

export type DetectPriorAuthSignalsInput = {
  lines: ReadonlyArray<{ cpt: string; units: number }>;
  encounter: Pick<Encounter, "dateOfService" | "placeOfService" | "visitType">;
  coverages: ReadonlyArray<
    Pick<Coverage, "planName" | "status" | "payerName">
  >;
  unknownPlanBehavior: UnknownPlanBehavior;
  /** Sum of therapy CPT units above this triggers review (default 12). */
  therapyUnitsThreshold?: number;
};

export type DetectPriorAuthSignalsResult = {
  signals: PriorAuthSignal[];
  /** When true, staff should confirm benefits before relying on heuristics alone. */
  unknownPlanReview: boolean;
};

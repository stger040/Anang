/** Canonical `PriorAuthEvent.eventType` values (also used in platform logs / cron). */
export const PriorAuthEventTypes = {
  CREATED: "prior_auth.created",
  STATUS: "prior_auth.status_changed",
  CHECKLIST: "prior_auth.checklist_updated",
  LINK_ENCOUNTER: "prior_auth.linked_encounter",
  LINK_CLAIM: "prior_auth.linked_claim",
  NOTE: "prior_auth.note",
  SLA_OVERDUE: "prior_auth.sla_overdue",
  SLA_EXPIRING: "prior_auth.sla_expiring_soon",
  SLA_FOLLOWUP: "prior_auth.sla_followup_needed",
} as const;

export type PriorAuthTelemetryFields = {
  tenantId: string;
  orgSlug: string;
  caseId: string;
  claimId?: string | null;
  encounterId?: string | null;
  requestId?: string | null;
};

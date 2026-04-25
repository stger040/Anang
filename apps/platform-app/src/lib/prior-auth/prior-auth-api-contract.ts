/**
 * Typed REST contract for future `/api/prior-auth/*` consumers (mobile, integrations).
 * Phase 1 UI uses Server Actions; route handlers below are thin stubs.
 */

import type { PriorAuthStatus, PriorAuthUrgency } from "@prisma/client";

export type PriorAuthCaseListQuery = {
  orgSlug: string;
  status?: PriorAuthStatus;
};

export type PriorAuthCaseCreateBody = {
  orgSlug: string;
  patientId: string;
  payerName: string;
  payerPlanName?: string | null;
  urgency?: PriorAuthUrgency;
  encounterId?: string | null;
  claimId?: string | null;
  coverageId?: string | null;
};

export type PriorAuthCasePatchBody = {
  status?: PriorAuthStatus;
  authorizationNumber?: string | null;
  expiresAt?: string | null;
};

// TODO: wire `GET/POST /api/prior-auth/cases` and `GET/PATCH /api/prior-auth/cases/:id`
// to shared mutation helpers once external auth (API keys / m2m) is defined.

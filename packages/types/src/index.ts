/** Aligned with Prisma enums — keep in sync with platform-app schema */

export const MODULE_KEYS = [
  "CORE",
  "BUILD",
  "PAY",
  "CONNECT",
  "INSIGHT",
  "SUPPORT",
  "COVER",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const CLAIM_STATUSES = [
  "DRAFT",
  "READY",
  "SUBMITTED",
  "ACCEPTED",
  "DENIED",
  "PAID",
  "APPEALED",
] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type EntitlementCheck = {
  tenantSlug: string;
  module: ModuleKey;
};

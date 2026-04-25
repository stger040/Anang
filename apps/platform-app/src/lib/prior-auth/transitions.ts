import { PriorAuthStatus } from "@prisma/client";

const ALLOWED: Record<PriorAuthStatus, PriorAuthStatus[]> = {
  [PriorAuthStatus.DRAFT]: [
    PriorAuthStatus.INTAKE,
    PriorAuthStatus.REVIEW_REQUIRED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.INTAKE]: [
    PriorAuthStatus.REVIEW_REQUIRED,
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.REVIEW_REQUIRED]: [
    PriorAuthStatus.INTAKE,
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.SUBMITTED]: [
    PriorAuthStatus.IN_REVIEW,
    PriorAuthStatus.PENDING_INFO,
    PriorAuthStatus.APPROVED,
    PriorAuthStatus.DENIED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.IN_REVIEW]: [
    PriorAuthStatus.PENDING_INFO,
    PriorAuthStatus.APPROVED,
    PriorAuthStatus.DENIED,
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.PENDING_INFO]: [
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.IN_REVIEW,
    PriorAuthStatus.REWORK,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.APPROVED]: [
    PriorAuthStatus.EXPIRED,
    PriorAuthStatus.REWORK,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.DENIED]: [
    PriorAuthStatus.REWORK,
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.EXPIRED]: [PriorAuthStatus.REWORK, PriorAuthStatus.SUBMITTED, PriorAuthStatus.CANCELLED],
  [PriorAuthStatus.REWORK]: [
    PriorAuthStatus.INTAKE,
    PriorAuthStatus.REVIEW_REQUIRED,
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.CANCELLED,
  ],
  [PriorAuthStatus.CANCELLED]: [],
};

export function canTransitionPriorAuthStatus(
  from: PriorAuthStatus,
  to: PriorAuthStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertLegalPriorAuthTransition(
  from: PriorAuthStatus,
  to: PriorAuthStatus,
): void {
  if (!canTransitionPriorAuthStatus(from, to)) {
    throw new Error(`Illegal prior auth status transition: ${from} → ${to}`);
  }
}

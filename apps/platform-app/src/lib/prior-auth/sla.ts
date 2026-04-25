import { PriorAuthStatus } from "@prisma/client";

export type PriorAuthSlaFlags = {
  overdue: boolean;
  expiringSoon: boolean;
  followUpNeeded: boolean;
};

type CaseLike = {
  status: PriorAuthStatus;
  dueAt: Date | null;
  expiresAt: Date | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

/**
 * SLA helpers for staff queues — uses tenant-configured windows (days/hours), not payer SLAs.
 */
export function computePriorAuthSlaFlags(
  row: CaseLike,
  opts: {
    now: Date;
    expiringSoonDays: number;
    followUpIntervalHours: number;
    /** Active work states where `dueAt` drives overdue. */
    activeDueStatuses: PriorAuthStatus[];
  },
): PriorAuthSlaFlags {
  const now = opts.now.getTime();
  const expMs = opts.expiringSoonDays * 86400000;

  const overdue =
    row.dueAt != null &&
    opts.activeDueStatuses.includes(row.status) &&
    row.dueAt.getTime() < now;

  const expiringSoon =
    row.expiresAt != null &&
    row.status === PriorAuthStatus.APPROVED &&
    row.expiresAt.getTime() > now &&
    row.expiresAt.getTime() <= now + expMs;

  const followUpNeeded =
    row.submittedAt != null &&
    opts.activeDueStatuses.includes(row.status) &&
    now - row.updatedAt.getTime() >= opts.followUpIntervalHours * 3600000;

  return { overdue, expiringSoon, followUpNeeded };
}

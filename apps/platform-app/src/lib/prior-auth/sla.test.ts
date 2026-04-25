import { PriorAuthStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { computePriorAuthSlaFlags } from "./sla";

describe("computePriorAuthSlaFlags", () => {
  const active: PriorAuthStatus[] = [
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.IN_REVIEW,
    PriorAuthStatus.PENDING_INFO,
  ];

  it("marks overdue when dueAt passed in active status", () => {
    const now = new Date("2026-04-21T12:00:00Z");
    const f = computePriorAuthSlaFlags(
      {
        status: PriorAuthStatus.IN_REVIEW,
        dueAt: new Date("2026-04-20T12:00:00Z"),
        expiresAt: null,
        submittedAt: new Date("2026-04-10T12:00:00Z"),
        updatedAt: new Date("2026-04-19T12:00:00Z"),
      },
      {
        now,
        expiringSoonDays: 14,
        followUpIntervalHours: 48,
        activeDueStatuses: active,
      },
    );
    expect(f.overdue).toBe(true);
    expect(f.expiringSoon).toBe(false);
  });

  it("marks expiring soon for approved auth nearing expiration", () => {
    const now = new Date("2026-04-21T12:00:00Z");
    const f = computePriorAuthSlaFlags(
      {
        status: PriorAuthStatus.APPROVED,
        dueAt: null,
        expiresAt: new Date("2026-05-01T12:00:00Z"),
        submittedAt: new Date("2026-03-01T12:00:00Z"),
        updatedAt: new Date("2026-04-01T12:00:00Z"),
      },
      {
        now,
        expiringSoonDays: 14,
        followUpIntervalHours: 48,
        activeDueStatuses: active,
      },
    );
    expect(f.expiringSoon).toBe(true);
    expect(f.overdue).toBe(false);
  });

  it("marks follow-up when idle beyond interval", () => {
    const now = new Date("2026-04-21T12:00:00Z");
    const f = computePriorAuthSlaFlags(
      {
        status: PriorAuthStatus.SUBMITTED,
        dueAt: new Date("2026-05-01T12:00:00Z"),
        expiresAt: null,
        submittedAt: new Date("2026-04-01T12:00:00Z"),
        updatedAt: new Date("2026-04-18T12:00:00Z"),
      },
      {
        now,
        expiringSoonDays: 14,
        followUpIntervalHours: 48,
        activeDueStatuses: active,
      },
    );
    expect(f.followUpNeeded).toBe(true);
  });
});

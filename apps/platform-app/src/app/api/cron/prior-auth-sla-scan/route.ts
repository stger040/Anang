import { appendPriorAuthSystemEventDb } from "@/lib/prior-auth/mutations";
import { PriorAuthEventTypes } from "@/lib/prior-auth/events";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { PriorAuthStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const DEDUPE_MS = 23 * 3600000;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function recentEventExists(
  db: ReturnType<typeof tenantPrisma>,
  caseId: string,
  eventType: string,
  since: Date,
): Promise<boolean> {
  const row = await db.priorAuthEvent.findFirst({
    where: { caseId, eventType, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(row);
}

async function handleCron(req: Request) {
  if (!authorizeCron(req)) {
    if (!process.env.CRON_SECRET?.trim()) {
      return NextResponse.json(
        { error: "CRON_SECRET is not set on the server." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true, settings: true } });

  let overdueScanned = 0;
  let overdueMarked = 0;
  let expiringScanned = 0;
  let expiringMarked = 0;

  const activeDue: PriorAuthStatus[] = [
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.IN_REVIEW,
    PriorAuthStatus.PENDING_INFO,
  ];

  for (const t of tenants) {
    const db = tenantPrisma(t.slug);
    const impl = parseImplementationSettings(
      t.settings &&
        typeof t.settings === "object" &&
        !Array.isArray(t.settings)
        ? (t.settings as Record<string, unknown>).implementation
        : null,
    );
    const expiringSoonDays = impl?.priorAuth?.expiringSoonDays ?? 14;

    const overdue = await db.priorAuthCase.findMany({
      where: {
        tenantId: t.id,
        dueAt: { lt: now },
        status: { in: activeDue },
      },
      select: { id: true },
    });
    overdueScanned += overdue.length;
    const dedupeSince = new Date(now.getTime() - DEDUPE_MS);
    for (const c of overdue) {
      if (await recentEventExists(db, c.id, PriorAuthEventTypes.SLA_OVERDUE, dedupeSince)) {
        continue;
      }
      await appendPriorAuthSystemEventDb({
        db,
        tenantId: t.id,
        orgSlug: t.slug,
        caseId: c.id,
        eventType: PriorAuthEventTypes.SLA_OVERDUE,
        payload: { scannedAt: now.toISOString() },
        auditAction: "prior_auth.case.overdue",
      });
      overdueMarked += 1;
    }

    const soon = new Date(now.getTime() + expiringSoonDays * 86400000);
    const expiring = await db.priorAuthCase.findMany({
      where: {
        tenantId: t.id,
        status: PriorAuthStatus.APPROVED,
        expiresAt: { lte: soon, gt: now },
      },
      select: { id: true },
    });
    expiringScanned += expiring.length;
    for (const c of expiring) {
      if (await recentEventExists(db, c.id, PriorAuthEventTypes.SLA_EXPIRING, dedupeSince)) {
        continue;
      }
      await appendPriorAuthSystemEventDb({
        db,
        tenantId: t.id,
        orgSlug: t.slug,
        caseId: c.id,
        eventType: PriorAuthEventTypes.SLA_EXPIRING,
        payload: { scannedAt: now.toISOString(), expiringSoonDays },
        auditAction: "prior_auth.case.expiring_soon",
      });
      expiringMarked += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    tenants: tenants.length,
    overdueScanned,
    overdueMarked,
    expiringScanned,
    expiringMarked,
    ts: now.toISOString(),
  });
}

export function GET(req: Request) {
  return handleCron(req);
}

export function POST(req: Request) {
  return handleCron(req);
}

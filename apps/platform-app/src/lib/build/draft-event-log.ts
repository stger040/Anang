import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type BuildDraftEventType =
  | "rules_synced"
  | "draft_approved"
  | "ai_suggestion_applied"
  | "draft_lines_cleared_test";

export async function logBuildDraftEvent(
  db: DbClient,
  args: {
    tenantId: string;
    draftId: string;
    eventType: BuildDraftEventType;
    payload?: Record<string, unknown>;
    actorUserId?: string | null;
  },
): Promise<void> {
  await db.buildDraftEvent.create({
    data: {
      tenantId: args.tenantId,
      draftId: args.draftId,
      eventType: args.eventType,
      payload: (args.payload ?? {}) as Prisma.InputJsonValue,
      actorUserId: args.actorUserId ?? null,
    },
  });
}

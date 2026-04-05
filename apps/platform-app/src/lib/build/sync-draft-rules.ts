import { ClaimIssueSource } from "@prisma/client";

import { logBuildDraftEvent } from "@/lib/build/draft-event-log";
import {
  applyBuildRulePack,
  parseBuildRulePackConfig,
  type BuildRulePackConfig,
} from "@/lib/build/rule-pack-config";
import { attachRetrievalCitations } from "@/lib/build/retrieval";
import { evaluateClaimDraftRules } from "@/lib/build/rules-engine";
import { prisma } from "@/lib/prisma";

import type { Prisma, PrismaClient } from "@prisma/client";

async function loadRulePackForTenant(
  db: PrismaClient,
  tenantId: string,
): Promise<BuildRulePackConfig> {
  const row = await db.buildRulePack.findUnique({
    where: { tenantId },
    select: { config: true },
  });
  if (!row?.config) return {};
  const parsed = parseBuildRulePackConfig(row.config);
  return parsed.ok ? parsed.config : {};
}

export async function syncClaimDraftRuleIssues(
  db: PrismaClient,
  args: { tenantId: string; draftId: string },
): Promise<void> {
  const draft = await db.claimDraft.findFirst({
    where: { id: args.draftId, tenantId: args.tenantId },
    include: { lines: true, encounter: true },
  });
  if (!draft) return;

  const pack = await loadRulePackForTenant(db, args.tenantId);
  const raw = evaluateClaimDraftRules({
    lines: draft.lines,
    encounter: draft.encounter,
  });
  const packed = applyBuildRulePack(raw, pack);
  const payloads = await attachRetrievalCitations(db, {
    tenantId: args.tenantId,
    issues: packed,
    lines: draft.lines,
  });

  await db.$transaction(async (tx) => {
    await tx.claimIssue.deleteMany({
      where: { draftId: args.draftId, issueSource: ClaimIssueSource.RULE },
    });
    if (payloads.length > 0) {
      await tx.claimIssue.createMany({
        data: payloads.map((p) => ({
          draftId: args.draftId,
          severity: p.severity,
          category: p.category,
          title: p.title,
          detail: p.detail,
          explainability: p.explainability,
          ruleKey: p.ruleKey,
          issueSource: p.issueSource,
          citations: (p.citations ?? []) as Prisma.InputJsonValue,
        })),
      });
    }
    await logBuildDraftEvent(tx, {
      tenantId: args.tenantId,
      draftId: args.draftId,
      eventType: "rules_synced",
      payload: {
        ruleIssueCount: payloads.length,
        ruleKeys: payloads.map((p) => p.ruleKey),
        citationChunkIds: payloads.flatMap((p) =>
          (p.citations ?? []).map((c) => c.chunkId),
        ),
      },
    });
  });
}

/** Server / job entrypoint — uses default Prisma client. */
export async function syncClaimDraftRuleIssuesForTenantDraft(args: {
  tenantId: string;
  draftId: string;
}) {
  await syncClaimDraftRuleIssues(prisma, args);
}

import type { ClaimDraftLine } from "@prisma/client";

import type { BuildIssueCitation, RuleIssuePayload } from "@/lib/build/rules-engine";

import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

const EXCERPT_MAX = 280;

export function normalizeCpt(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function normalizeIcd10(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function excerptForCitation(body: string): string {
  const t = body.trim().replace(/\s+/g, " ");
  if (t.length <= EXCERPT_MAX) return t;
  return `${t.slice(0, EXCERPT_MAX - 1)}…`;
}

/** Last colon segment is a ClaimDraftLine id when it looks like a cuid. */
export function lineIdFromRuleKeySuffix(ruleKey: string): string | null {
  const idx = ruleKey.lastIndexOf(":");
  if (idx <= 0) return null;
  const tail = ruleKey.slice(idx + 1);
  if (/^[a-z0-9]{20,}$/i.test(tail)) return tail;
  return null;
}

export type CodeLookup = { kind: "cpt" | "icd10"; lookup: string };

function dedupeLookups(keys: CodeLookup[]): CodeLookup[] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    const s = `${k.kind}:${k.lookup}`;
    if (!k.lookup || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
}

export function codeLookupsForRule(
  ruleKey: string,
  lines: ClaimDraftLine[],
): CodeLookup[] {
  if (ruleKey.startsWith("build.ncci.em.cardiology.pair:")) {
    const out: CodeLookup[] = [];
    for (const line of lines) {
      const c = normalizeCpt(line.cpt);
      if (c === "93015") out.push({ kind: "cpt", lookup: c });
      if (/^99(2|3|4)\d{2}$/.test(c)) out.push({ kind: "cpt", lookup: c });
    }
    return dedupeLookups(out);
  }

  const lineId = lineIdFromRuleKeySuffix(ruleKey);
  if (lineId) {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return [];
    const keys: CodeLookup[] = [];

    if (
      ruleKey.startsWith("build.cpt.required:") ||
      ruleKey.startsWith("build.units.min:") ||
      ruleKey.startsWith("build.charge.nonnegative:")
    ) {
      const c = normalizeCpt(line.cpt);
      if (c) keys.push({ kind: "cpt", lookup: c });
    }

    if (
      ruleKey.startsWith("build.icd10.required:") ||
      ruleKey.startsWith("build.units.min:") ||
      ruleKey.startsWith("build.charge.nonnegative:")
    ) {
      const i = normalizeIcd10(line.icd10);
      if (i) keys.push({ kind: "icd10", lookup: i });
    }

    return dedupeLookups(keys);
  }

  return [];
}

function collectAllLookups(
  issues: RuleIssuePayload[],
  lines: ClaimDraftLine[],
): { cpt: string[]; icd10: string[] } {
  const cpt = new Set<string>();
  const icd10 = new Set<string>();
  for (const issue of issues) {
    for (const k of codeLookupsForRule(issue.ruleKey, lines)) {
      if (k.kind === "cpt") cpt.add(k.lookup);
      else icd10.add(k.lookup);
    }
  }
  return { cpt: [...cpt], icd10: [...icd10] };
}

/**
 * Attach `BuildKnowledgeChunk` excerpts to rule issues (exact code match per tenant).
 */
export async function attachRetrievalCitations(
  db: DbClient,
  args: {
    tenantId: string;
    issues: RuleIssuePayload[];
    lines: ClaimDraftLine[];
  },
): Promise<RuleIssuePayload[]> {
  const { cpt, icd10 } = collectAllLookups(args.issues, args.lines);
  if (cpt.length === 0 && icd10.length === 0) return args.issues;

  const chunks = await db.buildKnowledgeChunk.findMany({
    where: {
      tenantId: args.tenantId,
      OR: [
        ...(cpt.length > 0
          ? [{ kind: "cpt", lookupKey: { in: cpt } as const }]
          : []),
        ...(icd10.length > 0
          ? [{ kind: "icd10", lookupKey: { in: icd10 } as const }]
          : []),
      ],
    },
  });

  const byKindKey = new Map<string, (typeof chunks)[number]>();
  for (const ch of chunks) {
    byKindKey.set(`${ch.kind}:${ch.lookupKey}`, ch);
  }

  return args.issues.map((issue) => {
    const look = codeLookupsForRule(issue.ruleKey, args.lines);
    const cites: BuildIssueCitation[] = [];
    for (const k of look) {
      const ch = byKindKey.get(`${k.kind}:${k.lookup}`);
      if (ch) {
        cites.push({
          chunkId: ch.id,
          title: ch.title,
          excerpt: excerptForCitation(ch.body),
          sourceLabel: ch.sourceLabel,
        });
      }
    }
    if (cites.length === 0) return issue;
    return { ...issue, citations: cites };
  });
}

import { detectPriorAuthSignals } from "@/lib/prior-auth/heuristics";
import {
  DEFAULT_PRIOR_AUTH_HIGH_RISK,
  type PriorAuthSignalCategoryKey,
} from "@/lib/prior-auth/defaults";
import type { UnknownPlanBehavior } from "@/lib/prior-auth/types";
import type { ClaimDraftLine, Coverage, Encounter } from "@prisma/client";
import { ClaimIssueSource } from "@prisma/client";

/** Grounding snippet from `BuildKnowledgeChunk` (B3 retrieval). */
export type BuildIssueCitation = {
  chunkId: string;
  title: string;
  excerpt: string;
  sourceLabel?: string | null;
};

export type RuleIssuePayload = {
  ruleKey: string;
  severity: string;
  category: string;
  title: string;
  detail: string;
  explainability: string;
  issueSource: ClaimIssueSource;
  citations?: BuildIssueCitation[];
};

function lineLabel(line: ClaimDraftLine, index: number): string {
  const cpt = line.cpt?.trim() || "(no CPT)";
  return `Line ${index + 1} (${cpt})`;
}

/**
 * Deterministic Build checks — must run meaningfully with all LLMs disabled.
 */
export function evaluateClaimDraftRules(args: {
  lines: ClaimDraftLine[];
  encounter: Pick<Encounter, "dateOfService">;
}): RuleIssuePayload[] {
  const out: RuleIssuePayload[] = [];
  const { lines, encounter } = args;

  if (lines.length === 0) {
    out.push({
      ruleKey: "build.lines.required",
      severity: "critical",
      category: "coding",
      title: "No claim lines on draft",
      detail:
        "Submitted professional/institutional claims require at least one service line with coded charges.",
      explainability:
        "Rule build.lines.required: empty ClaimDraftLine set for this encounter.",
      issueSource: ClaimIssueSource.RULE,
    });
    return out;
  }

  const cpts = lines.map((l) => l.cpt.trim());
  const hasEm = cpts.some((c) => /^99(2|3|4)\d{2}$/.test(c));
  const hasCardiacStress = cpts.some((c) => c === "93015");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const label = lineLabel(line, i);

    if (!line.cpt?.trim()) {
      out.push({
        ruleKey: `build.cpt.required:${line.id}`,
        severity: "critical",
        category: "coding",
        title: `Missing CPT / HCPCS — ${label}`,
        detail:
          "Each service line must include a procedure or supply code before submission.",
        explainability:
          "Rule build.cpt.required: ClaimDraftLine.cpt is empty after trim.",
        issueSource: ClaimIssueSource.RULE,
      });
    }

    if (!line.icd10?.trim()) {
      out.push({
        ruleKey: `build.icd10.required:${line.id}`,
        severity: "warning",
        category: "coding",
        title: `Missing ICD-10 — ${label}`,
        detail:
          "Payers typically require at least one diagnosis pointer per line (varies by claim type).",
        explainability:
          "Rule build.icd10.required: ClaimDraftLine.icd10 is empty after trim.",
        issueSource: ClaimIssueSource.RULE,
      });
    }

    if (line.units < 1) {
      out.push({
        ruleKey: `build.units.min:${line.id}`,
        severity: "critical",
        category: "coding",
        title: `Invalid units — ${label}`,
        detail: "Service units must be at least 1 for this draft.",
        explainability: "Rule build.units.min: units < 1.",
        issueSource: ClaimIssueSource.RULE,
      });
    }

    if (line.chargeCents < 0) {
      out.push({
        ruleKey: `build.charge.nonnegative:${line.id}`,
        severity: "critical",
        category: "coding",
        title: `Negative charge — ${label}`,
        detail:
          "Charge amount must be zero or positive unless your PM uses offset lines (not modeled here).",
        explainability: "Rule build.charge.nonnegative: chargeCents < 0.",
        issueSource: ClaimIssueSource.RULE,
      });
    }
  }

  if (hasEm && hasCardiacStress) {
    out.push({
      ruleKey: "build.ncci.em.cardiology.pair:93015_992xx",
      severity: "warning",
      category: "denial_risk",
      title: "E/M plus cardiac stress test — edit scrutiny",
      detail:
        "Same-day E/M (992xx) with exercise stress (93015) often draws NCCI / MUE or payer bundling edits. Confirm medical necessity narrative and distinct services.",
      explainability:
        `Rule build.ncci.em.cardiology.pair: DOS ${encounter.dateOfService.toISOString().slice(0, 10)} has both E/M pattern 992xx and CPT 93015.`,
      issueSource: ClaimIssueSource.RULE,
    });
  }

  return out;
}

/** Build rule issues for medical-benefit prior auth screening (Connect Phase 1 — deterministic). */
export function evaluatePriorAuthBuildRuleIssues(args: {
  lines: ClaimDraftLine[];
  encounter: Pick<Encounter, "dateOfService" | "placeOfService" | "visitType">;
  coverages: Pick<Coverage, "planName" | "status" | "payerName">[];
  unknownPlanBehavior?: UnknownPlanBehavior;
  therapyUnitsThreshold?: number;
  /** When omitted, all default high-risk categories apply. Pass `[]` to disable heuristics. */
  enabledCategoryKeys?: PriorAuthSignalCategoryKey[];
}): RuleIssuePayload[] {
  if (args.lines.length === 0) return [];
  const keys =
    args.enabledCategoryKeys === undefined
      ? DEFAULT_PRIOR_AUTH_HIGH_RISK
      : args.enabledCategoryKeys;
  const enabled = new Set(keys);
  const unknownPlanBehavior = args.unknownPlanBehavior ?? "review_required";
  const det = detectPriorAuthSignals(
    {
      lines: args.lines.map((l) => ({ cpt: l.cpt, units: l.units })),
      encounter: args.encounter,
      coverages: args.coverages,
      unknownPlanBehavior,
      therapyUnitsThreshold: args.therapyUnitsThreshold,
    },
    enabled,
  );
  const out: RuleIssuePayload[] = [];
  for (const s of det.signals) {
    out.push({
      ruleKey: `prior_auth.signal.${s.category}`,
      severity: "warning",
      category: "prior_auth",
      title: `Prior authorization likely — ${s.category.replaceAll("_", " ")}`,
      detail: s.rationale,
      explainability: `Deterministic heuristic on CPT/HCPCS: ${s.codes.join(", ")}.`,
      issueSource: ClaimIssueSource.RULE,
    });
  }
  if (det.unknownPlanReview) {
    out.push({
      ruleKey: "prior_auth.plan.unknown",
      severity: "warning",
      category: "prior_auth",
      title: "Coverage / plan unclear — prior auth review",
      detail:
        "Primary payer or plan name could not be confirmed from coverage rows. Treat benefit verification and authorization path as unknown until confirmed.",
      explainability:
        "Rule prior_auth.plan.unknown: all coverages missing plan label or marked unknown.",
      issueSource: ClaimIssueSource.RULE,
    });
  }
  return out;
}

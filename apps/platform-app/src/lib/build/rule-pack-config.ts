import type { RuleIssuePayload } from "@/lib/build/rules-engine";

export type BuildRulePackConfig = {
  /** Exact ruleKey or prefix rule: entry ending with `*` disables all keys that start with the prefix before `*`. */
  disabledRuleKeys?: string[];
  /** Map base key (e.g. `build.icd10.required`) → severity; applies to ruleKey `base` and `base:*`. */
  severityOverrides?: Record<string, "info" | "warning" | "critical">;
  /** Non-executable notes for implementers (ignored by engine). */
  notes?: string;
};

const SEVERITIES = new Set(["info", "warning", "critical"]);

export function parseBuildRulePackConfig(
  raw: unknown,
): { ok: true; config: BuildRulePackConfig } | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, config: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Rule pack must be a JSON object." };
  }
  const o = raw as Record<string, unknown>;
  const out: BuildRulePackConfig = {};

  if (o.notes !== undefined) {
    if (typeof o.notes !== "string") {
      return { ok: false, error: "`notes` must be a string." };
    }
    out.notes = o.notes;
  }

  if (o.disabledRuleKeys !== undefined) {
    if (!Array.isArray(o.disabledRuleKeys)) {
      return { ok: false, error: "`disabledRuleKeys` must be an array of strings." };
    }
    for (const x of o.disabledRuleKeys) {
      if (typeof x !== "string" || !x.trim()) {
        return {
          ok: false,
          error: "`disabledRuleKeys` entries must be non-empty strings.",
        };
      }
    }
    out.disabledRuleKeys = o.disabledRuleKeys.map((x) => (x as string).trim());
  }

  if (o.severityOverrides !== undefined) {
    if (
      typeof o.severityOverrides !== "object" ||
      o.severityOverrides === null ||
      Array.isArray(o.severityOverrides)
    ) {
      return {
        ok: false,
        error: "`severityOverrides` must be an object of string → severity.",
      };
    }
    const sev: Record<string, "info" | "warning" | "critical"> = {};
    for (const [k, v] of Object.entries(o.severityOverrides)) {
      if (typeof k !== "string" || !k.trim()) {
        return { ok: false, error: "Invalid severity override key." };
      }
      if (typeof v !== "string" || !SEVERITIES.has(v)) {
        return {
          ok: false,
          error: `Invalid severity for "${k}" (use info, warning, or critical).`,
        };
      }
      sev[k.trim()] = v as "info" | "warning" | "critical";
    }
    out.severityOverrides = sev;
  }

  return { ok: true, config: out };
}

export function isRuleKeyDisabled(
  ruleKey: string,
  disabledRuleKeys: string[] | undefined,
): boolean {
  if (!disabledRuleKeys?.length) return false;
  for (const d of disabledRuleKeys) {
    if (d.endsWith("*") && d.length > 1) {
      const prefix = d.slice(0, -1);
      if (ruleKey.startsWith(prefix)) return true;
    } else if (ruleKey === d) {
      return true;
    }
  }
  return false;
}

/** Longest matching override key wins (most specific prefix). */
export function resolveSeverityOverride(
  ruleKey: string,
  severityOverrides: Record<string, "info" | "warning" | "critical"> | undefined,
): "info" | "warning" | "critical" | undefined {
  if (!severityOverrides || Object.keys(severityOverrides).length === 0) {
    return undefined;
  }
  const keys = Object.keys(severityOverrides).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (ruleKey === k || ruleKey.startsWith(`${k}:`)) {
      return severityOverrides[k];
    }
  }
  return undefined;
}

export function applyBuildRulePack(
  issues: RuleIssuePayload[],
  pack: BuildRulePackConfig,
): RuleIssuePayload[] {
  const disabled = pack.disabledRuleKeys;
  const overrides = pack.severityOverrides;
  const out: RuleIssuePayload[] = [];
  for (const issue of issues) {
    if (isRuleKeyDisabled(issue.ruleKey, disabled)) continue;
    const sev = resolveSeverityOverride(issue.ruleKey, overrides);
    if (sev != null && sev !== issue.severity) {
      out.push({ ...issue, severity: sev });
    } else {
      out.push(issue);
    }
  }
  return out;
}

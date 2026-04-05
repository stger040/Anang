/**
 * Teaching-grade X12 structural checks (E2b2b4) — not a full HIPAA SNIP validator.
 * Envelope: ISA/IEA, GS/GE, ST/SE segment counts; light mandatory segments per transaction type.
 */

import {
  detectTransactionSet,
  splitX12Segments,
  type X12TransactionSet,
} from "./x12-segments";

export type X12ValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type X12StructuralGuide =
  | "837P-5010-teaching"
  | "277-5010-min"
  | "835-5010-min"
  | "997-5010-min"
  | "999-5010-min"
  | "unknown";

export type X12ValidationResult = {
  ok: boolean;
  issues: X12ValidationIssue[];
  guide: X12StructuralGuide;
  transactionSet: X12TransactionSet;
  segmentCount: number;
};

function guideForTs(ts: X12TransactionSet): X12StructuralGuide {
  switch (ts) {
    case "837":
      return "837P-5010-teaching";
    case "277":
      return "277-5010-min";
    case "835":
      return "835-5010-min";
    case "997":
      return "997-5010-min";
    case "999":
      return "999-5010-min";
    default:
      return "unknown";
  }
}

function push(
  issues: X12ValidationIssue[],
  code: string,
  message: string,
  severity: X12ValidationIssue["severity"],
) {
  issues.push({ code, message, severity });
}

/** True when any error-level issue is present. */
export function x12ValidationHasErrors(result: X12ValidationResult): boolean {
  return result.issues.some((i) => i.severity === "error");
}

export function isInboundX12StructuralValidationStrict(): boolean {
  return process.env.EDI_INBOUND_X12_VALIDATE_STRICT === "true";
}

function normControl(s: string): string {
  return (s ?? "").trim();
}

function findStSePairs(
  segments: string[],
  from: number,
  to: number,
): X12ValidationIssue[] {
  const issues: X12ValidationIssue[] = [];
  let i = from;
  while (i <= to) {
    const seg = segments[i];
    if (!seg.startsWith("ST*")) {
      i += 1;
      continue;
    }
    const stParts = seg.split("*");
    const stCtrl = normControl(stParts[2] ?? "");
    if (!stCtrl) {
      push(
        issues,
        "ST_CONTROL_EMPTY",
        `ST segment at index ${i} has no transaction set control number.`,
        "error",
      );
      i += 1;
      continue;
    }
    let j = i + 1;
    let seIdx = -1;
    while (j <= to) {
      const s = segments[j];
      if (s.startsWith("SE*")) {
        const seParts = s.split("*");
        if (normControl(seParts[2] ?? "") === stCtrl) {
          seIdx = j;
          break;
        }
      }
      j += 1;
    }
    if (seIdx < 0) {
      push(
        issues,
        "SE_MISSING",
        `No matching SE*…*${stCtrl} for ST ending at index ${i}.`,
        "error",
      );
      i += 1;
      continue;
    }
    const seParts = segments[seIdx].split("*");
    const declared = Number.parseInt(normControl(seParts[1] ?? ""), 10);
    const actual = seIdx - i + 1;
    if (!Number.isFinite(declared) || declared !== actual) {
      push(
        issues,
        "SE_COUNT_MISMATCH",
        `SE segment count: declared ${declared}, actual ${actual} (ST…SE inclusive, ST ctrl ${stCtrl}).`,
        "error",
      );
    }
    i = seIdx + 1;
  }
  return issues;
}

function validateEnvelope(segments: string[]): X12ValidationIssue[] {
  const issues: X12ValidationIssue[] = [];
  if (segments.length === 0) {
    push(issues, "EMPTY", "No segments to validate.", "error");
    return issues;
  }

  const isaIdx = segments.findIndex((s) => s.startsWith("ISA*"));
  const ieaIdx = segments.findIndex((s) => s.startsWith("IEA*"));
  if (isaIdx < 0) {
    push(issues, "ISA_MISSING", "ISA envelope segment not found.", "error");
  }
  if (ieaIdx < 0) {
    push(issues, "IEA_MISSING", "IEA envelope segment not found.", "error");
  }
  if (isaIdx >= 0) {
    const isaParts = segments[isaIdx].split("*");
    if (isaParts.length < 14) {
      push(
        issues,
        "ISA_SHORT",
        "ISA segment has fewer elements than expected for interchange control alignment.",
        "warning",
      );
    }
    const isa13 = normControl(isaParts[13] ?? "");
    if (ieaIdx >= 0) {
      const ieaParts = segments[ieaIdx].split("*");
      const iea02 = normControl(ieaParts[2] ?? "");
      if (isa13 && iea02 && isa13 !== iea02) {
        push(
          issues,
          "IEA_ISA_MISMATCH",
          `IEA interchange control (${iea02}) does not match ISA (${isa13}).`,
          "error",
        );
      }
    }
  }

  const gsIdx = segments.findIndex((s) => s.startsWith("GS*"));
  const geIdx = segments.findIndex((s) => s.startsWith("GE*"));
  if (gsIdx < 0) {
    push(issues, "GS_MISSING", "GS functional group header not found.", "error");
  }
  if (geIdx < 0) {
    push(issues, "GE_MISSING", "GE functional group trailer not found.", "error");
  }
  if (gsIdx >= 0 && geIdx >= 0) {
    if (gsIdx > geIdx) {
      push(issues, "GS_GE_ORDER", "GS appears after GE.", "error");
    }
    const gsParts = segments[gsIdx].split("*");
    const geParts = segments[geIdx].split("*");
    const gs06 = normControl(gsParts[6] ?? "");
    const ge02 = normControl(geParts[2] ?? "");
    if (gs06 && ge02 && gs06 !== ge02) {
      push(
        issues,
        "GE_GS_CONTROL_MISMATCH",
        `GE group control (${ge02}) does not match GS (${gs06}).`,
        "error",
      );
    }
    issues.push(...findStSePairs(segments, gsIdx + 1, geIdx - 1));
  }

  const isaCount = segments.filter((s) => s.startsWith("ISA*")).length;
  if (isaCount > 1) {
    push(
      issues,
      "MULTI_ISA",
      "Multiple ISA segments — only the first interchange is validated in this pass.",
      "warning",
    );
  }

  return issues;
}

function sliceFirstTransaction(
  segments: string[],
  ts: X12TransactionSet,
): string[] {
  const code =
    ts === "unknown"
      ? null
      : ts === "837"
        ? "837"
        : ts === "277"
          ? "277"
          : ts === "835"
            ? "835"
            : ts === "997"
              ? "997"
              : ts === "999"
                ? "999"
                : null;
  if (!code) return segments;
  const prefix = `ST*${code}*`;
  const stIdx = segments.findIndex((s) => s.startsWith(prefix));
  if (stIdx < 0) return segments;
  const stParts = segments[stIdx].split("*");
  const stCtrl = normControl(stParts[2] ?? "");
  const out: string[] = [];
  for (let i = stIdx; i < segments.length; i++) {
    out.push(segments[i]);
    const s = segments[i];
    if (s.startsWith("SE*")) {
      const seParts = s.split("*");
      if (normControl(seParts[2] ?? "") === stCtrl) {
        break;
      }
    }
  }
  return out;
}

function validateTransactionContent(
  segments: string[],
  ts: X12TransactionSet,
): X12ValidationIssue[] {
  const issues: X12ValidationIssue[] = [];
  const tx = sliceFirstTransaction(segments, ts);
  const joined = tx.join("~");

  switch (ts) {
    case "837":
      if (!tx.some((s) => s.startsWith("BHT*"))) {
        push(issues, "837_NO_BHT", "837 transaction missing BHT segment.", "error");
      }
      if (!tx.some((s) => s.startsWith("CLM*"))) {
        push(
          issues,
          "837_NO_CLM",
          "837 professional claim missing CLM segment.",
          "error",
        );
      }
      break;
    case "277":
      if (!tx.some((s) => s.startsWith("BHT*"))) {
        push(issues, "277_NO_BHT", "277 missing BHT segment.", "warning");
      }
      break;
    case "835":
      if (!joined.includes("BPR*") && !tx.some((s) => s.startsWith("BPR*"))) {
        push(issues, "835_NO_BPR", "835 missing BPR segment.", "warning");
      }
      break;
    case "997":
    case "999":
      if (!tx.some((s) => s.startsWith("AK1*"))) {
        push(
          issues,
          "ACK_NO_AK1",
          `${ts} missing AK1 functional group response.`,
          "error",
        );
      }
      break;
    default:
      push(
        issues,
        "UNKNOWN_TS",
        "Could not determine ST* transaction type for content rules.",
        "warning",
      );
  }
  return issues;
}

/**
 * Validates raw X12 string. Reuses `segments` when provided (avoid double split).
 */
export function validateX12Structure(
  raw: string,
  opts?: {
    segments?: string[];
    /** Stricter 837 professional checks (CLM, BHT). */
    expect837Professional?: boolean;
  },
): X12ValidationResult {
  const issues: X12ValidationIssue[] = [];
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: false,
      issues: [{ code: "EMPTY", message: "Payload is empty.", severity: "error" }],
      guide: "unknown",
      transactionSet: "unknown",
      segmentCount: 0,
    };
  }
  if (!trimmed.includes("~")) {
    push(issues, "NO_SEGMENT_TERMINATOR", "No ~ segment terminators found.", "error");
  }

  const segments = opts?.segments ?? splitX12Segments(trimmed);
  const transactionSet = detectTransactionSet(segments);
  const guide = guideForTs(transactionSet);

  issues.push(...validateEnvelope(segments));

  if (transactionSet !== "unknown") {
    issues.push(...validateTransactionContent(segments, transactionSet));
  }

  if (opts?.expect837Professional && transactionSet === "837") {
    if (!segments.some((s) => s.startsWith("ST*837*"))) {
      push(issues, "837_ST", "Expected ST*837* professional transaction.", "error");
    }
  }

  const hasErr = issues.some((i) => i.severity === "error");
  return {
    ok: !hasErr,
    issues,
    guide,
    transactionSet,
    segmentCount: segments.length,
  };
}

/** Short summary for IngestionBatch.metadata or audit. */
export function summarizeX12Validation(v: X12ValidationResult): Record<string, unknown> {
  return {
    ok: v.ok,
    guide: v.guide,
    transactionSet: v.transactionSet,
    segmentCount: v.segmentCount,
    errorCount: v.issues.filter((i) => i.severity === "error").length,
    warningCount: v.issues.filter((i) => i.severity === "warning").length,
    codes: v.issues.map((i) => i.code),
  };
}

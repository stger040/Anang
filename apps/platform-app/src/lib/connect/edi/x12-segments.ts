/**
 * Minimal X12 segment helpers for HIPAA 5010-style 277 / 835 CLP rows.
 * Not a full parser — enough to attach claim status and remittance to canonical Claim rows.
 */

export type X12TransactionSet =
  | "277"
  | "835"
  | "837"
  | "997"
  | "999"
  | "unknown";

export function splitX12Segments(raw: string): string[] {
  const normalized = raw
    .replace(/\r\n/g, "")
    .replace(/\n/g, "")
    .replace(/\r/g, "");
  return normalized
    .split("~")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function detectTransactionSet(segments: string[]): X12TransactionSet {
  for (const seg of segments) {
    if (seg.startsWith("ST*277")) return "277";
    if (seg.startsWith("ST*835")) return "835";
    if (seg.startsWith("ST*837")) return "837";
    if (seg.startsWith("ST*997")) return "997";
    if (seg.startsWith("ST*999")) return "999";
  }
  return "unknown";
}

/** ISA/GS/ST envelope hints from an outbound 837 interchange (first matching segments). */
export type Outbound837ControlHints = {
  interchangeControlNumber: string | null;
  groupControlNumber: string | null;
  transactionSetControlNumber: string | null;
};

export function extractOutbound837ControlHints(
  segments: string[],
): Outbound837ControlHints {
  let interchangeControlNumber: string | null = null;
  let groupControlNumber: string | null = null;
  let transactionSetControlNumber: string | null = null;

  for (const seg of segments) {
    if (!interchangeControlNumber && seg.startsWith("ISA*")) {
      const p = seg.split("*");
      interchangeControlNumber = (p[13] ?? "").trim() || null;
    }
    if (!groupControlNumber && seg.startsWith("GS*")) {
      const p = seg.split("*");
      groupControlNumber = (p[6] ?? "").trim() || null;
    }
    if (!transactionSetControlNumber && seg.startsWith("ST*837")) {
      const p = seg.split("*");
      transactionSetControlNumber = (p[2] ?? "").trim() || null;
    }
    if (interchangeControlNumber && groupControlNumber && transactionSetControlNumber) {
      break;
    }
  }

  return {
    interchangeControlNumber,
    groupControlNumber,
    transactionSetControlNumber,
  };
}

/** One functional / implementation ack row for an 837 transaction set (AK2/AK5). */
export type ParsedFunctionalAck837 = {
  groupControl: string;
  stControl: string;
  /** AK5 acknowledgment code: A accepted, R rejected, P partial, etc. */
  ak5Code: string | null;
};

function is837Ak2TransactionSetId(raw: string): boolean {
  const t = raw.trim().toUpperCase();
  return t === "837" || t.includes("837");
}

/**
 * Parses AK1/AK2/AK5 loops for 997 or 999 (minimal — enough to correlate ST control numbers).
 */
export function extractFunctionalAcks837(
  segments: string[],
): ParsedFunctionalAck837[] {
  let currentGroup = "";
  const out: ParsedFunctionalAck837[] = [];
  let pendingAk2: { stControl: string; tsId: string } | null = null;

  for (const seg of segments) {
    if (seg.startsWith("AK1*")) {
      const p = seg.split("*");
      currentGroup = (p[2] ?? "").trim();
      pendingAk2 = null;
      continue;
    }
    if (seg.startsWith("AK2*")) {
      const p = seg.split("*");
      const tsId = (p[1] ?? "").trim();
      const stControl = (p[2] ?? "").trim();
      pendingAk2 = { stControl, tsId };
      continue;
    }
    if (seg.startsWith("AK5*") && pendingAk2) {
      const p = seg.split("*");
      const code = (p[1] ?? "").trim() || null;
      if (is837Ak2TransactionSetId(pendingAk2.tsId) && pendingAk2.stControl) {
        out.push({
          groupControl: currentGroup,
          stControl: pendingAk2.stControl,
          ak5Code: code,
        });
      }
      pendingAk2 = null;
    }
  }
  return out;
}

/** Compare X12 control numbers with leading-zero normalization. */
export function x12ControlNumbersMatch(a: string, b: string): boolean {
  const na = (a ?? "").trim().replace(/^0+/, "") || "0";
  const nb = (b ?? "").trim().replace(/^0+/, "") || "0";
  return na === nb;
}

/** CLP fields used for 277 claim status and 835 remittance lines. */
export type ParsedClpRow = {
  submitterClaimId: string;
  /** CLP02 — claim status code (table differs slightly by transaction set). */
  statusCode: string;
  /** CLP03 — total claim charge (837/277 context) or charge in 835 (often element 3). */
  totalChargeAmount: string | null;
  /** CLP04 — claim payment amount (835); may be missing in 277. */
  claimPaymentAmount: string | null;
};

function parseClpSegment(seg: string): ParsedClpRow | null {
  if (!seg.startsWith("CLP*")) {
    return null;
  }
  const parts = seg.split("*");
  const submitterClaimId = (parts[1] ?? "").trim();
  const statusCode = (parts[2] ?? "").trim();
  if (!submitterClaimId || !statusCode) {
    return null;
  }
  const totalChargeAmount = parts[3]?.trim() || null;
  const claimPaymentAmount = parts[4]?.trim() || null;
  return {
    submitterClaimId,
    statusCode,
    totalChargeAmount,
    claimPaymentAmount,
  };
}

export function extractClpRows(segments: string[]): ParsedClpRow[] {
  const out: ParsedClpRow[] = [];
  for (const seg of segments) {
    const row = parseClpSegment(seg);
    if (row) {
      out.push(row);
    }
  }
  return out;
}

/** One CAS reason / amount tuple (5010 CAS repeats reason–amount–quantity). */
export type Parsed835CasAdjustment = {
  claimAdjustmentGroupCode: string;
  carcCode: string;
  adjustmentAmountCents: number;
  quantity: number | null;
  rarcCodes: string[];
};

/** AMT*qualifier*amount rows seen in the 2110 SVC loop (allowed / benefit hints). */
export type Parsed835Amt = { qualifier: string; cents: number };

/**
 * 835 service line from SVC + following CAS / LQ / AMT until next SVC (spreadsheet depth).
 */
export type Parsed835ServiceLine = {
  procedureCode: string | null;
  lineBilledCents: number;
  linePaidCents: number;
  lineAllowedCents: number;
  patientResponsibilityCents: number;
  /** Sum of |adjustment amount| for quick rollups. */
  adjustmentSumAbsCents: number;
  /** First CARC on the line (filters / legacy). */
  carcCode: string | null;
  /** All RARC (LQ*HE*) on the line in segment order. */
  rarcCodes: string[];
  adjustments: Parsed835CasAdjustment[];
  amtSegments: Parsed835Amt[];
};

/** MIA/MOA segments between CLP and first SVC (claim-level financial context). */
export type Parsed835ClpFinancialContext = {
  miaSegments: string[];
  moaSegments: string[];
};

/** Segment indices of each `CLP*` row in document order (835 / 277). */
export function findClpSegmentIndices(segments: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i]?.startsWith("CLP*")) {
      out.push(i);
    }
  }
  return out;
}

export function clpInnerSegmentsExclusive(
  segments: string[],
  clpIndex: number,
): string[] {
  const inner: string[] = [];
  for (let i = clpIndex + 1; i < segments.length; i++) {
    const s = segments[i];
    if (s.startsWith("CLP*")) break;
    if (s.startsWith("SE*")) break;
    inner.push(s);
  }
  return inner;
}

function parseSvcProcedure(parts: string[]): string | null {
  const raw = (parts[1] ?? "").trim();
  if (!raw) return null;
  const colon = raw.indexOf(":");
  const code = colon >= 0 ? raw.slice(colon + 1).trim() : raw;
  return code || null;
}

function parse835SvcSegment(seg: string): {
  procedureCode: string | null;
  lineBilledCents: number;
  linePaidCents: number;
} | null {
  if (!seg.startsWith("SVC*")) return null;
  const p = seg.split("*");
  return {
    procedureCode: parseSvcProcedure(p),
    lineBilledCents: parseX12MoneyToCents(p[2] ?? null) ?? 0,
    linePaidCents: parseX12MoneyToCents(p[3] ?? null) ?? 0,
  };
}

/** Qualifiers often used for line allowed / benefit amounts in 835 2110 (payer-dependent). */
const AMT_ALLOWED_QUALIFIERS = new Set([
  "AA",
  "AU",
  "A8",
  "B6",
  "NE",
  "F5",
  "D8",
  "BD",
  "I1",
]);

function parse835AmtSegment(seg: string): Parsed835Amt | null {
  if (!seg.startsWith("AMT*")) return null;
  const p = seg.split("*");
  const qualifier = (p[1] ?? "").trim();
  const cents = parseX12MoneyToCents(p[2] ?? null);
  if (!qualifier || cents == null) return null;
  return { qualifier, cents };
}

/**
 * Expand one CAS segment into 1..n adjustment rows (repeated reason / amount / quantity).
 */
export function parse835CasSegment(seg: string): Parsed835CasAdjustment[] {
  if (!seg.startsWith("CAS*")) return [];
  const p = seg.split("*");
  const group = (p[1] ?? "").trim() || "UN";
  const out: Parsed835CasAdjustment[] = [];
  for (let k = 2; k < p.length; k += 3) {
    const reason = (p[k] ?? "").trim();
    const amtRaw = p[k + 1] ?? "";
    const qtyRaw = (p[k + 2] ?? "").trim();
    if (!reason && !amtRaw.trim()) break;
    if (!reason) continue;
    const adjustmentAmountCents = parseX12MoneyToCents(amtRaw) ?? 0;
    let quantity: number | null = null;
    if (qtyRaw.length > 0) {
      const n = Number(qtyRaw);
      if (!Number.isNaN(n)) quantity = Math.trunc(n);
    }
    out.push({
      claimAdjustmentGroupCode: group,
      carcCode: reason,
      adjustmentAmountCents,
      quantity,
      rarcCodes: [],
    });
  }
  return out;
}

function attachRarcToLastAdjustment(
  adjustments: Parsed835CasAdjustment[],
  lineLevelRarcs: string[],
  rarc: string,
) {
  if (!rarc) return;
  const last = adjustments[adjustments.length - 1];
  if (last) {
    last.rarcCodes.push(rarc);
  } else {
    lineLevelRarcs.push(rarc);
  }
}

/** Walk segments between SVC rows (or full CLP inner when there is no SVC) for CAS/LQ/AMT. */
function walk835ServiceSliceForAdjustments(slice: string[]): {
  adjustments: Parsed835CasAdjustment[];
  amtSegments: Parsed835Amt[];
  lineLevelRarcs: string[];
} {
  const adjustments: Parsed835CasAdjustment[] = [];
  const amtSegments: Parsed835Amt[] = [];
  const lineLevelRarcs: string[] = [];

  for (const s of slice) {
    if (s.startsWith("SVC*")) break;
    if (s.startsWith("CAS*")) {
      for (const row of parse835CasSegment(s)) {
        adjustments.push(row);
      }
    } else if (s.startsWith("LQ*")) {
      const l = s.split("*");
      if ((l[1] ?? "").trim().toUpperCase() === "HE") {
        const rarc = (l[2] ?? "").trim().replace(/~+$/, "");
        attachRarcToLastAdjustment(adjustments, lineLevelRarcs, rarc);
      }
    } else if (s.startsWith("AMT*")) {
      const a = parse835AmtSegment(s);
      if (a) amtSegments.push(a);
    }
  }

  return { adjustments, amtSegments, lineLevelRarcs };
}

function compute835LineRollups(
  svc: { lineBilledCents: number; linePaidCents: number },
  adjustments: Parsed835CasAdjustment[],
  amtSegments: Parsed835Amt[],
  lineLevelRarcs: string[],
  procedureCode: string | null,
): Parsed835ServiceLine {
  const sumAbs = adjustments.reduce(
    (s, a) => s + Math.abs(a.adjustmentAmountCents),
    0,
  );
  let fromAmt: number | null = null;
  for (const a of amtSegments) {
    if (AMT_ALLOWED_QUALIFIERS.has(a.qualifier)) {
      fromAmt = a.cents;
      break;
    }
  }
  const sumCoOaPi = adjustments
    .filter((a) =>
      ["CO", "OA", "PI"].includes(a.claimAdjustmentGroupCode.toUpperCase()),
    )
    .reduce((s, a) => s + Math.abs(a.adjustmentAmountCents), 0);
  const lineAllowedCents =
    fromAmt != null
      ? fromAmt
      : Math.max(0, svc.lineBilledCents - sumCoOaPi);
  const sumPr = adjustments
    .filter((a) => a.claimAdjustmentGroupCode.toUpperCase() === "PR")
    .reduce((s, a) => s + Math.abs(a.adjustmentAmountCents), 0);
  const patientResponsibilityCents =
    sumPr > 0 ? sumPr : Math.max(0, lineAllowedCents - svc.linePaidCents);

  const allRarcs = [
    ...adjustments.flatMap((a) => a.rarcCodes),
    ...lineLevelRarcs,
  ];

  return {
    procedureCode,
    lineBilledCents: svc.lineBilledCents,
    linePaidCents: svc.linePaidCents,
    lineAllowedCents,
    patientResponsibilityCents,
    adjustmentSumAbsCents: sumAbs,
    carcCode: adjustments[0]?.carcCode ?? null,
    rarcCodes: allRarcs,
    adjustments,
    amtSegments,
  };
}

/**
 * MIA/MOA segments after CLP before the first SVC (if any).
 */
export function extract835ClpFinancialContext(inner: string[]): Parsed835ClpFinancialContext {
  const miaSegments: string[] = [];
  const moaSegments: string[] = [];
  for (const seg of inner) {
    if (seg.startsWith("SVC*")) break;
    if (seg.startsWith("MIA*")) miaSegments.push(seg);
    if (seg.startsWith("MOA*")) moaSegments.push(seg);
  }
  return { miaSegments, moaSegments };
}

/**
 * SVC loops: each SVC + CAS/LQ/AMT through the next SVC (multi-CARC, all RARC, AMT hints).
 * If there is no SVC, one synthetic line is built from CAS/LQ/AMT on the full inner slice;
 * use `claimBilledCents` / `claimPaidCents` from the CLP row for amounts on that synthetic line.
 */
export function extract835ServiceLinesForClp(
  segments: string[],
  clpSegmentIndex: number,
  claimLevel: { billedCents: number; paidCents: number },
): Parsed835ServiceLine[] {
  const inner = clpInnerSegmentsExclusive(segments, clpSegmentIndex);
  const lines: Parsed835ServiceLine[] = [];

  let i = 0;
  while (i < inner.length) {
    const base = parse835SvcSegment(inner[i]!);
    if (!base) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < inner.length && !inner[j]!.startsWith("SVC*")) {
      j++;
    }
    const slice = inner.slice(i + 1, j);
    const walked = walk835ServiceSliceForAdjustments(slice);
    lines.push(
      compute835LineRollups(
        base,
        walked.adjustments,
        walked.amtSegments,
        walked.lineLevelRarcs,
        base.procedureCode,
      ),
    );
    i = j;
  }

  if (lines.length === 0) {
    const walked = walk835ServiceSliceForAdjustments(inner);
    lines.push(
      compute835LineRollups(
        {
          lineBilledCents: claimLevel.billedCents,
          linePaidCents: claimLevel.paidCents,
        },
        walked.adjustments,
        walked.amtSegments,
        walked.lineLevelRarcs,
        null,
      ),
    );
  }

  return lines;
}

/**
 * Parse X12 monetary element — typically dollars with optional decimals (R type).
 */
/**
 * TRN segment: TRN*trace_type_code*reference_identification*...
 * Returns TRN02 values (deduped, order preserved).
 */
export function extractTrnReferenceIds(segments: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of segments) {
    if (!seg.startsWith("TRN*")) {
      continue;
    }
    const parts = seg.split("*");
    const ref = (parts[2] ?? "").trim().replace(/~+$/, "");
    if (!ref || seen.has(ref)) {
      continue;
    }
    seen.add(ref);
    out.push(ref);
  }
  return out;
}

export function parseX12MoneyToCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const s = String(raw).trim();
  if (!s) {
    return null;
  }
  const n = Number(s);
  if (Number.isNaN(n)) {
    return null;
  }
  return Math.round(n * 100);
}

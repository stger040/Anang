import type { Prisma, PrismaClient } from "@prisma/client";
import { ClaimLifecycleStatus } from "@prisma/client";
import { createHash } from "node:crypto";

type DbClient = PrismaClient | Prisma.TransactionClient;

import {
  clpInnerSegmentsExclusive,
  detectTransactionSet,
  extract835ClpFinancialContext,
  extract835ServiceLinesForClp,
  extractClpRows,
  extractFunctionalAcks837,
  extractTrnReferenceIds,
  findClpSegmentIndices,
  parseX12MoneyToCents,
  splitX12Segments,
  x12ControlNumbersMatch,
  type Parsed835ServiceLine,
  type ParsedClpRow,
  type ParsedFunctionalAck837,
  type X12TransactionSet,
} from "./x12-segments";
import {
  validateX12Structure,
  x12ValidationHasErrors,
  type X12ValidationResult,
} from "./validate-x12-structure";

export type InboundX12ApplyResult = {
  transactionSet: X12TransactionSet;
  matched: { claimNumber: string; action: string }[];
  unmatchedSubmitterIds: string[];
  skipped: string[];
  functionalAckMatched: {
    claimId: string;
    submissionId: string;
    stControl: string;
    ak5Code: string | null;
    groupControl: string;
  }[];
  functionalAckUnmatched: { stControl: string; groupControl: string }[];
  structuralValidation: X12ValidationResult;
  applySkippedDueToValidation?: boolean;
};

type InboundApplyContext = {
  receivedAt: string;
  trnRefs: string[];
  ingestionBatchId?: string;
};

function ediContextPatch(ctx: InboundApplyContext): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    lastInboundAt: ctx.receivedAt,
    ...(ctx.ingestionBatchId
      ? { lastEdiIngestionBatchId: ctx.ingestionBatchId }
      : {}),
  };
  if (ctx.trnRefs.length > 0) {
    patch.lastInboundTrnRefs = ctx.trnRefs.slice(0, 15);
  }
  return patch;
}

function isDenied277(code: string): boolean {
  return ["3", "4", "23", "24"].includes(code);
}

function isAccepted277(code: string): boolean {
  return ["1", "2", "19", "20", "21"].includes(code);
}

function lifecycleHint277(code: string): ClaimLifecycleStatus | null {
  if (isDenied277(code)) return ClaimLifecycleStatus.DENIED;
  if (isAccepted277(code)) return ClaimLifecycleStatus.ACCEPTED;
  return null;
}

function mergeEdiRefs(
  prev: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  return { ...base, ...patch };
}

async function apply277Row(
  db: DbClient,
  tenantId: string,
  row: ParsedClpRow,
  ctx: InboundApplyContext,
): Promise<{ kind: "matched" | "unmatched"; claimNumber: string; action?: string }> {
  const claim = await db.claim.findFirst({
    where: { tenantId, claimNumber: row.submitterClaimId },
  });
  if (!claim) {
    return { kind: "unmatched", claimNumber: row.submitterClaimId };
  }

  const hint = lifecycleHint277(row.statusCode);
  const nextStatus =
    hint &&
    claim.status !== ClaimLifecycleStatus.PAID &&
    claim.status !== ClaimLifecycleStatus.APPEALED
      ? hint
      : claim.status;

  let detail = `277 CLP status ${row.statusCode} for submitter id ${row.submitterClaimId}`;
  if (ctx.trnRefs.length > 0) {
    detail += ` · TRN ${ctx.trnRefs.join(", ")}`;
  }
  const label =
    hint === ClaimLifecycleStatus.DENIED
      ? "277 — payer denied / rejected"
      : hint === ClaimLifecycleStatus.ACCEPTED
        ? "277 — claim accepted at payer"
        : `277 — status code ${row.statusCode}`;

  await db.claim.update({
    where: { id: claim.id },
    data: {
      status: nextStatus,
      ediRefs: mergeEdiRefs(claim.ediRefs, {
        ...ediContextPatch(ctx),
        lastTransactionSet: "277",
        last277StatusCode: row.statusCode,
        last277SubmitterClaimId: row.submitterClaimId,
      }) as Prisma.InputJsonValue,
      ...(hint === ClaimLifecycleStatus.DENIED && !claim.denialReason
        ? { denialReason: `277 CLP02=${row.statusCode}` }
        : {}),
    },
  });

  await db.claimTimelineEvent.create({
    data: {
      claimId: claim.id,
      label,
      detail,
    },
  });

  return {
    kind: "matched",
    claimNumber: row.submitterClaimId,
    action: nextStatus !== claim.status ? `status→${nextStatus}` : "timeline",
  };
}

const DENIED_835 = new Set(["2", "4", "22", "23"]);

async function upsertRemittance835FromInbound835(
  db: DbClient,
  tenantId: string,
  args: {
    remittanceKey: string;
    eraTraceNumber: string | null;
    ingestionBatchId?: string;
  },
) {
  return db.remittance835.upsert({
    where: {
      tenantId_remittanceKey: {
        tenantId,
        remittanceKey: args.remittanceKey,
      },
    },
    create: {
      tenantId,
      remittanceKey: args.remittanceKey,
      eraTraceNumber: args.eraTraceNumber,
      source: "edi_835",
      metadata: {
        ingestionBatchId: args.ingestionBatchId ?? null,
      } as Prisma.InputJsonValue,
    },
    update: {
      ...(args.eraTraceNumber ? { eraTraceNumber: args.eraTraceNumber } : {}),
    },
  });
}

async function persist835ClaimAdjudicationSlice(
  db: DbClient,
  tenantId: string,
  claimId: string,
  row: ParsedClpRow,
  remittance: { id: string; key: string; clpIndex: number },
  payCentsResolved: number,
  serviceLines: Parsed835ServiceLine[],
  clpInnerSegments: string[],
) {
  const claim = await db.claim.findFirst({ where: { id: claimId, tenantId } });
  if (!claim) return;

  let billedCents =
    parseX12MoneyToCents(row.totalChargeAmount) ?? claim.billedCents;
  let paidCents = Math.max(0, payCentsResolved);
  let allowedRollup = billedCents;
  let prRollup = Math.max(0, billedCents - paidCents);
  if (serviceLines.length > 0) {
    const sumBilled = serviceLines.reduce((s, ln) => s + ln.lineBilledCents, 0);
    const sumPaid = serviceLines.reduce((s, ln) => s + ln.linePaidCents, 0);
    const sumAllowed = serviceLines.reduce(
      (s, ln) => s + ln.lineAllowedCents,
      0,
    );
    const sumPr = serviceLines.reduce(
      (s, ln) => s + ln.patientResponsibilityCents,
      0,
    );
    if (sumBilled > 0) billedCents = sumBilled;
    paidCents = sumPaid;
    allowedRollup = sumAllowed;
    prRollup = sumPr;
  }
  const prCents = prRollup;
  const adjudicationKey = `${remittance.key}:${row.submitterClaimId}:${remittance.clpIndex}`;
  const denied = DENIED_835.has(row.statusCode);
  const denialCategory = denied ? `835 CLP02=${row.statusCode}` : null;

  const finCtx = extract835ClpFinancialContext(clpInnerSegments);
  const inboundExtra = {
    source: "edi_835_inbound",
    clpStatus: row.statusCode,
    miaSegments: finCtx.miaSegments,
    moaSegments: finCtx.moaSegments,
  } as Prisma.InputJsonValue;

  const adj = await db.claimAdjudication.upsert({
    where: {
      tenantId_adjudicationKey: { tenantId, adjudicationKey },
    },
    create: {
      tenantId,
      remittance835Id: remittance.id,
      adjudicationKey,
      claimId,
      adjudicationDate: new Date(),
      allowedCents: allowedRollup,
      paidCents,
      patientResponsibilityCents: prCents,
      finalizedFlag: true,
      denialCategory,
      claimStatusAtAdjudication: row.statusCode,
      extra: inboundExtra,
    },
    update: {
      adjudicationDate: new Date(),
      allowedCents: allowedRollup,
      paidCents,
      patientResponsibilityCents: prCents,
      denialCategory,
      claimStatusAtAdjudication: row.statusCode,
      extra: inboundExtra,
    },
  });

  await db.remittanceAdjudicationLine.deleteMany({
    where: { claimAdjudicationId: adj.id },
  });

  const hasSvcLine = serviceLines.some((l) => l.procedureCode != null);

  if (serviceLines.length > 0) {
    for (let si = 0; si < serviceLines.length; si++) {
      const ln = serviceLines[si]!;
      const lineKey = hasSvcLine
        ? `${adjudicationKey}:svc:${si}`
        : `${adjudicationKey}:clp`;
      const lineExtra = {
        rarcCodes: ln.rarcCodes,
        amtSegments: ln.amtSegments,
        casTupleCount: ln.adjustments.length,
      } as Prisma.InputJsonValue;
      const line = await db.remittanceAdjudicationLine.create({
        data: {
          tenantId,
          claimAdjudicationId: adj.id,
          remittanceLineKey: lineKey,
          adjudicationDate: new Date(),
          procedureCode: ln.procedureCode,
          lineBilledCents: ln.lineBilledCents,
          lineAllowedCents: ln.lineAllowedCents,
          linePaidCents: ln.linePaidCents,
          patientResponsibilityCents: ln.patientResponsibilityCents,
          adjustmentCents: ln.adjustmentSumAbsCents,
          carcCode: ln.carcCode,
          rarcCode: ln.rarcCodes[0] ?? null,
          lineAdjudicationStatus: row.statusCode,
          procedureDescription:
            ln.adjustments.length > 0
              ? `835 · ${ln.adjustments.length} CAS adjustment(s)`
              : ln.procedureCode
                ? `835 SVC`
                : "835 claim-level CAS/LQ/AMT",
          denialCategory: ln.carcCode ? `835 CARC ${ln.carcCode}` : null,
          extra: lineExtra,
        },
      });

      for (let ai = 0; ai < ln.adjustments.length; ai++) {
        const a = ln.adjustments[ai]!;
        await db.remittanceAdjudicationAdjustment.create({
          data: {
            tenantId,
            remittanceAdjudicationLineId: line.id,
            sequence: ai,
            claimAdjustmentGroupCode: a.claimAdjustmentGroupCode,
            carcCode: a.carcCode,
            adjustmentAmountCents: a.adjustmentAmountCents,
            quantity: a.quantity,
            rarcCodes: a.rarcCodes as Prisma.InputJsonValue,
          },
        });
      }
    }
  } else {
    const lineKey = `${adjudicationKey}:clp`;
    await db.remittanceAdjudicationLine.create({
      data: {
        tenantId,
        claimAdjudicationId: adj.id,
        remittanceLineKey: lineKey,
        adjudicationDate: new Date(),
        lineBilledCents: billedCents,
        lineAllowedCents: billedCents,
        linePaidCents: paidCents,
        patientResponsibilityCents: prCents,
        lineAdjudicationStatus: row.statusCode,
        procedureDescription: "Claim-level 835 CLP (no SVC rows in payload)",
        denialCategory,
      },
    });
  }
}

async function apply835Row(
  db: DbClient,
  tenantId: string,
  row: ParsedClpRow,
  ctx: InboundApplyContext,
  remittance: { id: string; key: string; clpIndex: number } | null,
  serviceLines: Parsed835ServiceLine[],
  clpInnerSegments: string[],
): Promise<{ kind: "matched" | "unmatched"; claimNumber: string; action?: string }> {
  const claim = await db.claim.findFirst({
    where: { tenantId, claimNumber: row.submitterClaimId },
  });
  if (!claim) {
    return { kind: "unmatched", claimNumber: row.submitterClaimId };
  }

  const payCents = parseX12MoneyToCents(row.claimPaymentAmount);
  let timelineDetail = `835 CLP02=${row.statusCode}; pay ${row.claimPaymentAmount ?? "—"}; charge ${row.totalChargeAmount ?? "—"}`;
  if (ctx.trnRefs.length > 0) {
    timelineDetail += ` · TRN ${ctx.trnRefs.join(", ")}`;
  }

  let nextStatus = claim.status;
  let paidUpdate: number | null | undefined = undefined;

  if (payCents != null && payCents > 0) {
    nextStatus = ClaimLifecycleStatus.PAID;
    paidUpdate = payCents;
  } else if (DENIED_835.has(row.statusCode)) {
    nextStatus = ClaimLifecycleStatus.DENIED;
  }

  await db.claim.update({
    where: { id: claim.id },
    data: {
      status: nextStatus,
      ...(paidUpdate != null ? { paidCents: paidUpdate } : {}),
      ...(nextStatus === ClaimLifecycleStatus.DENIED && !claim.denialReason
        ? { denialReason: `835 CLP02=${row.statusCode}` }
        : {}),
      ediRefs: mergeEdiRefs(claim.ediRefs, {
        ...ediContextPatch(ctx),
        lastTransactionSet: "835",
        last835StatusCode: row.statusCode,
        last835SubmitterClaimId: row.submitterClaimId,
        ...(row.claimPaymentAmount
          ? { last835PaymentRaw: row.claimPaymentAmount }
          : {}),
      }) as Prisma.InputJsonValue,
    },
  });

  await db.claimTimelineEvent.create({
    data: {
      claimId: claim.id,
      label:
        payCents != null && payCents > 0
          ? "835 — remittance / payment posted"
          : DENIED_835.has(row.statusCode)
            ? "835 — denial or zero pay"
            : `835 — CLP status ${row.statusCode}`,
      detail: timelineDetail,
    },
  });

  if (remittance) {
    await persist835ClaimAdjudicationSlice(
      db,
      tenantId,
      claim.id,
      row,
      remittance,
      payCents ?? 0,
      serviceLines,
      clpInnerSegments,
    );
  }

  return {
    kind: "matched",
    claimNumber: row.submitterClaimId,
    action:
      paidUpdate != null
        ? `paidCents=${paidUpdate}`
        : nextStatus !== claim.status
          ? `status→${nextStatus}`
          : "timeline",
  };
}

async function applyFunctionalAckRow(
  db: DbClient,
  tenantId: string,
  ack: ParsedFunctionalAck837,
  transactionSet: "997" | "999",
  ctx: InboundApplyContext,
): Promise<
  | { kind: "matched"; claimId: string; submissionId: string }
  | { kind: "unmatched"; stControl: string; groupControl: string }
> {
  const recent = await db.claim837EdiSubmission.findMany({
    where: {
      tenantId,
      transactionSetControlNumber: { not: null },
    },
    orderBy: { recordedAt: "desc" },
    take: 500,
  });
  const match = recent.find((s) => {
    if (
      !s.transactionSetControlNumber ||
      !x12ControlNumbersMatch(s.transactionSetControlNumber, ack.stControl)
    ) {
      return false;
    }
    if (ack.groupControl && s.groupControlNumber) {
      return x12ControlNumbersMatch(s.groupControlNumber, ack.groupControl);
    }
    return true;
  });
  if (!match) {
    return {
      kind: "unmatched",
      stControl: ack.stControl,
      groupControl: ack.groupControl,
    };
  }

  const claim = await db.claim.findFirst({ where: { id: match.claimId } });
  if (!claim) {
    return {
      kind: "unmatched",
      stControl: ack.stControl,
      groupControl: ack.groupControl,
    };
  }

  const label =
    transactionSet === "997"
      ? `997 — functional ack · AK5=${ack.ak5Code ?? "?"}`
      : `999 — implementation ack · AK5=${ack.ak5Code ?? "?"}`;
  const detail = `ST ${ack.stControl} · GS ${ack.groupControl || "—"} · AK5=${ack.ak5Code ?? "—"}`;

  await db.claim.update({
    where: { id: claim.id },
    data: {
      ediRefs: mergeEdiRefs(claim.ediRefs, {
        ...ediContextPatch(ctx),
        lastTransactionSet: transactionSet,
        lastFunctionalAckAt: ctx.receivedAt,
        lastFunctionalAckCode: ack.ak5Code,
        lastFunctionalAckStControl: ack.stControl,
        ...(ack.groupControl
          ? { lastFunctionalAckGroupControl: ack.groupControl }
          : {}),
      }) as Prisma.InputJsonValue,
    },
  });

  await db.claimTimelineEvent.create({
    data: {
      claimId: claim.id,
      label,
      detail,
    },
  });

  const prevSubmissionMeta =
    match.metadata &&
    typeof match.metadata === "object" &&
    !Array.isArray(match.metadata)
      ? { ...(match.metadata as Record<string, unknown>) }
      : {};

  await db.claim837EdiSubmission.update({
    where: { id: match.id },
    data: {
      metadata: {
        ...prevSubmissionMeta,
        lastInboundFunctionalAck: {
          transactionSet,
          receivedAt: ctx.receivedAt,
          ak5Code: ack.ak5Code,
          stControl: ack.stControl,
          groupControl: ack.groupControl || null,
        },
      } as Prisma.InputJsonValue,
    },
  });

  return {
    kind: "matched",
    claimId: claim.id,
    submissionId: match.id,
  };
}

/**
 * Applies 277 or 835 CLP rows to tenant claims matched on `Claim.claimNumber` === CLP submitter id.
 * **997 / 999** functional acks match `Claim837EdiSubmission` control numbers (ST, optional GS).
 * Unknown transaction sets no-op with skipped reason.
 */
export async function applyInboundX12ToTenant(args: {
  db: DbClient;
  tenantId: string;
  x12: string;
  /** When created in the same transaction as raw `SourceArtifact` storage. */
  ingestionBatchId?: string;
  structuralValidation?: X12ValidationResult;
  /** When true and validation reports errors, skip claim mutations (E2b2b4). */
  blockApplyOnStructuralError?: boolean;
}): Promise<InboundX12ApplyResult> {
  const { db, tenantId, x12, ingestionBatchId } = args;
  const segments = splitX12Segments(x12);
  const structuralValidation =
    args.structuralValidation ?? validateX12Structure(x12, { segments });

  if (
    args.blockApplyOnStructuralError &&
    x12ValidationHasErrors(structuralValidation)
  ) {
    return {
      transactionSet: structuralValidation.transactionSet,
      matched: [],
      unmatchedSubmitterIds: [],
      skipped: [
        "Structural validation failed — fix X12 or unset EDI_INBOUND_X12_VALIDATE_STRICT.",
      ],
      functionalAckMatched: [],
      functionalAckUnmatched: [],
      structuralValidation,
      applySkippedDueToValidation: true,
    };
  }

  const transactionSet = detectTransactionSet(segments);
  const receivedAt = new Date().toISOString();
  const trnRefs = extractTrnReferenceIds(segments);
  const ctx: InboundApplyContext = {
    receivedAt,
    trnRefs,
    ingestionBatchId,
  };

  const finish = (
    body: Omit<
      InboundX12ApplyResult,
      "structuralValidation" | "applySkippedDueToValidation"
    >,
  ): InboundX12ApplyResult => ({
    ...body,
    structuralValidation,
    applySkippedDueToValidation: false,
  });

  if (transactionSet === "997" || transactionSet === "999") {
    const acks = extractFunctionalAcks837(segments);
    if (acks.length === 0) {
      return finish({
        transactionSet,
        matched: [],
        unmatchedSubmitterIds: [],
        skipped: [`No AK2/AK5 ${transactionSet} rows for 837 correlation.`],
        functionalAckMatched: [],
        functionalAckUnmatched: [],
      });
    }
    const functionalAckMatched: InboundX12ApplyResult["functionalAckMatched"] =
      [];
    const functionalAckUnmatched: InboundX12ApplyResult["functionalAckUnmatched"] =
      [];
    for (const ack of acks) {
      const res = await applyFunctionalAckRow(
        db,
        tenantId,
        ack,
        transactionSet,
        ctx,
      );
      if (res.kind === "matched") {
        functionalAckMatched.push({
          claimId: res.claimId,
          submissionId: res.submissionId,
          stControl: ack.stControl,
          ak5Code: ack.ak5Code,
          groupControl: ack.groupControl,
        });
      } else {
        functionalAckUnmatched.push({
          stControl: res.stControl,
          groupControl: res.groupControl,
        });
      }
    }
    return finish({
      transactionSet,
      matched: [],
      unmatchedSubmitterIds: [],
      skipped: [],
      functionalAckMatched,
      functionalAckUnmatched,
    });
  }

  if (transactionSet !== "277" && transactionSet !== "835") {
    return finish({
      transactionSet,
      matched: [],
      unmatchedSubmitterIds: [],
      skipped: [
        transactionSet === "837"
          ? "837 inbound not applied (use 997/999 ack or 277/835 on this webhook)."
          : "No supported ST transaction set (277, 835, 997, 999).",
      ],
      functionalAckMatched: [],
      functionalAckUnmatched: [],
    });
  }

  const rows = extractClpRows(segments);
  if (rows.length === 0) {
    return finish({
      transactionSet,
      matched: [],
      unmatchedSubmitterIds: [],
      skipped: ["No CLP segments in payload."],
      functionalAckMatched: [],
      functionalAckUnmatched: [],
    });
  }

  const matched: { claimNumber: string; action: string }[] = [];
  const unmatchedSubmitterIds: string[] = [];

  let remittance835Ctx: { id: string; key: string } | null = null;
  const clpSegIdx =
    transactionSet === "835" ? findClpSegmentIndices(segments) : [];

  if (transactionSet === "835" && rows.length > 0) {
    const remittanceKey = ingestionBatchId
      ? `edi835:batch:${ingestionBatchId}`
      : `edi835:sha:${createHash("sha256").update(x12, "utf8").digest("hex").slice(0, 32)}`;
    const header = await upsertRemittance835FromInbound835(db, tenantId, {
      remittanceKey,
      eraTraceNumber: trnRefs[0] ?? null,
      ingestionBatchId,
    });
    remittance835Ctx = { id: header.id, key: remittanceKey };
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const clpAt = clpSegIdx[i];
    const clpInner =
      clpAt != null ? clpInnerSegmentsExclusive(segments, clpAt) : [];
    const clpBilled = parseX12MoneyToCents(row.totalChargeAmount) ?? 0;
    const clpPaid = parseX12MoneyToCents(row.claimPaymentAmount) ?? 0;
    const svcLines =
      transactionSet === "835" && clpAt != null
        ? extract835ServiceLinesForClp(segments, clpAt, {
            billedCents: clpBilled,
            paidCents: clpPaid,
          })
        : [];
    const res =
      transactionSet === "277"
        ? await apply277Row(db, tenantId, row, ctx)
        : await apply835Row(
            db,
            tenantId,
            row,
            ctx,
            remittance835Ctx
              ? { ...remittance835Ctx, clpIndex: i }
              : null,
            svcLines,
            clpInner,
          );
    if (res.kind === "unmatched") {
      unmatchedSubmitterIds.push(res.claimNumber);
    } else if (res.action) {
      matched.push({ claimNumber: res.claimNumber, action: res.action });
    }
  }

  return finish({
    transactionSet,
    matched,
    unmatchedSubmitterIds,
    skipped: [],
    functionalAckMatched: [],
    functionalAckUnmatched: [],
  });
}

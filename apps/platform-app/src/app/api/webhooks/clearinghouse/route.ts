import { applyInboundX12ToTenant } from "@/lib/connect/edi/apply-inbound-x12";
import {
  isInboundX12StructuralValidationStrict,
  summarizeX12Validation,
  validateX12Structure,
} from "@/lib/connect/edi/validate-x12-structure";
import { platformLog } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { createIngestionBatchRecordingRawPayload } from "@/lib/connectors/source-artifact";
import type { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

const MAX_BYTES = 2_000_000;

/**
 * Inbound X12 (277 / 835 / 997 / 999) for tenant-scoped claim updates.
 * Auth: Authorization: Bearer CLEARINGHOUSE_WEBHOOK_SECRET
 * Body JSON: { "tenantSlug": "…", "x12": "ISA*…" } (rawX12 alias accepted)
 */
export async function POST(req: Request) {
  const secret = process.env.CLEARINGHOUSE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Clearinghouse webhook not configured" },
      { status: 503 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const rec = body as Record<string, unknown>;
  const tenantSlug = String(rec.tenantSlug ?? "").trim();
  const x12 = String(rec.x12 ?? rec.rawX12 ?? "").trim();
  if (!tenantSlug || !x12) {
    return NextResponse.json(
      { error: "tenantSlug and x12 (or rawX12) are required" },
      { status: 400 },
    );
  }
  if (Buffer.byteLength(x12, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const hash = createHash("sha256").update(x12, "utf8").digest("hex");
  const payloadBytes = Buffer.byteLength(x12, "utf8");
  const structuralValidation = validateX12Structure(x12);

  let batch: { id: string };
  let artifact: { id: string; storageUri: string | null };
  let inlinePayloadStored: boolean;
  let externalStorageStored: boolean;
  let result: Awaited<ReturnType<typeof applyInboundX12ToTenant>>;

  try {
    const txOut = await prisma.$transaction(async (tx) => {
      const ingest = await createIngestionBatchRecordingRawPayload(tx, {
        tenantId: tenant.id,
        connectorKind: "edi_inbound",
        sourceKind: "x12_clearinghouse_inbound",
        rawText: x12,
        metadata: {
          path: "api.webhooks.clearinghouse",
          tenantSlug,
        },
      });

      const prevMeta =
        ingest.batch.metadata &&
        typeof ingest.batch.metadata === "object" &&
        !Array.isArray(ingest.batch.metadata)
          ? { ...(ingest.batch.metadata as Record<string, unknown>) }
          : {};

      const applyResult = await applyInboundX12ToTenant({
        db: tx,
        tenantId: tenant.id,
        x12,
        ingestionBatchId: ingest.batch.id,
        structuralValidation,
        blockApplyOnStructuralError: isInboundX12StructuralValidationStrict(),
      });

      await tx.ingestionBatch.update({
        where: { id: ingest.batch.id },
        data: {
          metadata: {
            ...prevMeta,
            structuralValidation: summarizeX12Validation(structuralValidation),
            structuralIssues: structuralValidation.issues.slice(0, 30),
            applySkippedDueToValidation:
              applyResult.applySkippedDueToValidation ?? false,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        batch: ingest.batch,
        artifact: ingest.artifact,
        inlinePayloadStored: ingest.inlinePayloadStored,
        externalStorageStored: ingest.externalStorageStored,
        result: applyResult,
      };
    });
    batch = txOut.batch;
    artifact = txOut.artifact;
    inlinePayloadStored = txOut.inlinePayloadStored;
    externalStorageStored = txOut.externalStorageStored;
    result = txOut.result;
  } catch (e) {
    platformLog("error", "connect.edi.inbound_webhook.transaction_failed", {
      tenantId: tenant.id,
      tenantSlug,
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, error: "Inbound apply transaction failed" },
      { status: 500 },
    );
  }

  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: null,
      action: "connect.edi.inbound_webhook",
      resource: "claim",
      metadata: {
        ingestionBatchId: batch.id,
        sourceArtifactId: artifact.id,
        sourceArtifactInlineStored: inlinePayloadStored,
        sourceArtifactExternalStored: externalStorageStored,
        transactionSet: result.transactionSet,
        clpMatched: result.matched.length,
        clpUnmatched: result.unmatchedSubmitterIds.length,
        functionalAckMatched: result.functionalAckMatched.length,
        functionalAckUnmatched: result.functionalAckUnmatched.length,
        skipped: result.skipped,
        structuralValidationOk: result.structuralValidation.ok,
        structuralErrorCount: result.structuralValidation.issues.filter(
          (i) => i.severity === "error",
        ).length,
        applySkippedDueToValidation: result.applySkippedDueToValidation,
        payloadSha256: hash,
        payloadBytes,
      },
    },
  });

  const structuralErrs = result.structuralValidation.issues.filter(
    (i) => i.severity === "error",
  ).length;

  platformLog("info", "connect.edi.inbound_webhook", {
    tenantId: tenant.id,
    tenantSlug,
    ingestionBatchId: batch.id,
    transactionSet: result.transactionSet,
    matched: result.matched.length,
    unmatched: result.unmatchedSubmitterIds.length,
    functionalAckMatched: result.functionalAckMatched.length,
    functionalAckUnmatched: result.functionalAckUnmatched.length,
    structuralErrorCount: structuralErrs,
    applySkippedDueToValidation: result.applySkippedDueToValidation ?? false,
  });

  if (
    result.applySkippedDueToValidation ||
    !result.structuralValidation.ok ||
    structuralErrs > 0
  ) {
    platformLog("error", "connect.edi.inbound_webhook.apply_degraded", {
      tenantId: tenant.id,
      tenantSlug,
      ingestionBatchId: batch.id,
      transactionSet: result.transactionSet,
      applySkippedDueToValidation: result.applySkippedDueToValidation ?? false,
      structuralOk: result.structuralValidation.ok,
      structuralErrorCount: structuralErrs,
    });
  }

  return NextResponse.json({
    ok: true,
    ingestionBatchId: batch.id,
    sourceArtifactId: artifact.id,
    inlinePayloadStored,
    externalStorageStored,
    sourceArtifactStorageUri: artifact.storageUri,
    ...result,
  });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

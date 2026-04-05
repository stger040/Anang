import { createHash } from "node:crypto";

import { createIngestionBatch } from "@/lib/connectors/canonical-ingest";
import type { ConnectorKind } from "@/lib/connectors/canonical-ingest";
import {
  buildEdiBlobObjectKey,
  isEdiBlobForceExternal,
  isEdiS3BlobStorageConfigured,
  putEdiBlobToS3,
} from "@/lib/connectors/edi-blob-s3";

import type { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Default cap for storing raw JSON/text on `SourceArtifact.textPayload` (Postgres `TEXT`). */
export const DEFAULT_MAX_INLINE_PAYLOAD_BYTES = 524_288;

export function resolveMaxInlinePayloadBytes(): number {
  const raw = process.env.FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES?.trim();
  if (!raw) return DEFAULT_MAX_INLINE_PAYLOAD_BYTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_INLINE_PAYLOAD_BYTES;
  return Math.min(Math.floor(n), 8 * 1024 * 1024);
}

export type PayloadFingerprint = {
  sha256Hex: string;
  byteLength: number;
  /** Populated when `byteLength <= resolveMaxInlinePayloadBytes()`. */
  textPayload: string | null;
};

export function fingerprintInlinePayload(rawText: string): PayloadFingerprint {
  const max = resolveMaxInlinePayloadBytes();
  const buf = Buffer.from(rawText, "utf8");
  const byteLength = buf.length;
  const sha256Hex = createHash("sha256").update(buf).digest("hex");
  const textPayload = byteLength <= max ? rawText : null;
  return { sha256Hex, byteLength, textPayload };
}

export async function createIngestionBatchRecordingRawPayload(
  db: DbClient,
  args: {
    tenantId: string;
    connectorKind: ConnectorKind;
    metadata?: Record<string, unknown>;
    sourceKind: string;
    rawText: string;
  },
) {
  const fp = fingerprintInlinePayload(args.rawText);
  const s3Ok = isEdiS3BlobStorageConfigured();
  const forceExternal = isEdiBlobForceExternal();

  if (forceExternal && !s3Ok) {
    throw new Error(
      "EDI_BLOB_FORCE_EXTERNAL=true requires EDI_S3_BUCKET and AWS credentials (or compatible endpoint).",
    );
  }

  const shouldWriteObject =
    s3Ok && (forceExternal || fp.textPayload === null);

  let storageUri: string | null = null;
  let textPayload: string | null = fp.textPayload;

  if (shouldWriteObject) {
    const key = buildEdiBlobObjectKey({
      tenantId: args.tenantId,
      sha256Hex: fp.sha256Hex,
      sourceKind: args.sourceKind,
    });
    const put = await putEdiBlobToS3({ key, body: args.rawText });
    storageUri = put.storageUri;
    textPayload = null;
  }

  const batch = await createIngestionBatch(db, {
    tenantId: args.tenantId,
    connectorKind: args.connectorKind,
    metadata: {
      ...(args.metadata ?? {}),
      ...(storageUri
        ? {
            ediBlobStorage: {
              storageUri,
              externalStorage: true,
            },
          }
        : {}),
    },
  });
  const artifact = await db.sourceArtifact.create({
    data: {
      tenantId: args.tenantId,
      ingestionBatchId: batch.id,
      kind: args.sourceKind,
      sha256Hex: fp.sha256Hex,
      byteLength: fp.byteLength,
      textPayload,
      storageUri,
    },
  });
  return {
    batch,
    artifact,
    inlinePayloadStored: textPayload != null,
    externalStorageStored: storageUri != null,
  };
}

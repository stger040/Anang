/**
 * Optional S3-compatible object storage for raw EDI / ingest payloads (E2b2b5).
 * When configured, oversized or policy-forced payloads are written with `s3://bucket/key` on `SourceArtifact.storageUri`.
 */

import {
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";

export function isEdiS3BlobStorageConfigured(): boolean {
  return Boolean(process.env.EDI_S3_BUCKET?.trim());
}

export function isEdiBlobForceExternal(): boolean {
  return process.env.EDI_BLOB_FORCE_EXTERNAL === "true";
}

function createS3Client(): S3Client {
  const region =
    process.env.EDI_S3_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    "us-east-1";
  const endpoint = process.env.EDI_S3_ENDPOINT?.trim();
  return new S3Client({
    region,
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: process.env.EDI_S3_FORCE_PATH_STYLE === "true",
        }
      : {}),
  });
}

/**
 * Stable, unique object key (no DB id required — upload can precede batch insert).
 */
export function buildEdiBlobObjectKey(args: {
  tenantId: string;
  sha256Hex: string;
  sourceKind: string;
}): string {
  const rawPrefix = process.env.EDI_S3_PREFIX?.trim() ?? "edi";
  const prefix = rawPrefix.replace(/^\/+|\/+$/g, "");
  const safeKind = args.sourceKind
    .replace(/[^a-zA-Z0-9_.-]+/g, "_")
    .slice(0, 80);
  const shortHash = args.sha256Hex.slice(0, 16);
  const uniq = randomBytes(6).toString("hex");
  return `${prefix}/tenant-${args.tenantId}/${safeKind}/${shortHash}-${uniq}.txt`;
}

export async function putEdiBlobToS3(args: {
  key: string;
  body: string;
}): Promise<{ storageUri: string; bucket: string; key: string }> {
  const bucket = process.env.EDI_S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("EDI_S3_BUCKET is not set");
  }
  const client = createS3Client();
  const buf = Buffer.from(args.body, "utf8");
  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: args.key,
    Body: buf,
    ContentType: "text/plain; charset=utf-8",
  };
  const kms = process.env.EDI_S3_KMS_KEY_ID?.trim();
  if (kms) {
    input.ServerSideEncryption = "aws:kms";
    input.SSEKMSKeyId = kms;
  }
  await client.send(new PutObjectCommand(input));
  return { storageUri: `s3://${bucket}/${args.key}`, bucket, key: args.key };
}

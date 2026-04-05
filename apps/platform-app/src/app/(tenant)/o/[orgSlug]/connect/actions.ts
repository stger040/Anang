"use server";

import {
  extractOutbound837ControlHints,
  splitX12Segments,
} from "@/lib/connect/edi/x12-segments";
import {
  validateX12Structure,
  x12ValidationHasErrors,
} from "@/lib/connect/edi/validate-x12-structure";
import {
  isEdiOutboundHttpConfigured,
  postEdiOutboundX12Http,
} from "@/lib/connect/edi/outbound-x12-http";
import { createIngestionBatchRecordingRawPayload } from "@/lib/connectors/source-artifact";
import { prisma } from "@/lib/prisma";
import { platformLog, readRequestIdFromHeaders } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { isTenantSettingsEditor } from "@/lib/tenant-admin-guard";
import { ModuleKey, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

function mergeEdiRefs(
  prev: unknown,
  patch: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...(prev as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Prisma.InputJsonValue;
}

export type Record837SubmissionState =
  | { error: string }
  | { ok: true }
  | null;

export type Record837OutboundState =
  | { error: string }
  | { ok: true; httpOk?: boolean; httpStatus?: number }
  | null;

export async function recordClaim837EdiSubmission(
  _prev: Record837SubmissionState,
  formData: FormData,
): Promise<Record837SubmissionState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const claimId = String(formData.get("claimId") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };
  if (!ctx.effectiveModules.has(ModuleKey.CONNECT)) {
    return { error: "Connect is not enabled for this account." };
  }

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error: "Only tenant admins or platform super admins can record 837 traces.",
    };
  }

  if (!claimId) {
    return { error: "Missing claim." };
  }

  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId: ctx.tenant.id },
  });
  if (!claim) {
    return { error: "Claim not found." };
  }

  const clearinghouseLabel = String(
    formData.get("clearinghouseLabel") ?? "",
  ).trim();
  const interchangeControlNumber = String(
    formData.get("interchangeControlNumber") ?? "",
  ).trim();
  const groupControlNumber = String(
    formData.get("groupControlNumber") ?? "",
  ).trim();
  const transactionSetControlNumber = String(
    formData.get("transactionSetControlNumber") ?? "",
  ).trim();
  const submitterTraceNumber = String(
    formData.get("submitterTraceNumber") ?? "",
  ).trim();
  const payerClaimControlRef = String(
    formData.get("payerClaimControlRef") ?? "",
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const hasControl =
    Boolean(interchangeControlNumber) ||
    Boolean(groupControlNumber) ||
    Boolean(transactionSetControlNumber) ||
    Boolean(submitterTraceNumber) ||
    Boolean(payerClaimControlRef);

  if (!clearinghouseLabel || !hasControl) {
    return {
      error:
        "Provide a clearinghouse / partner label and at least one control number or trace field (ISA, GS, ST, submitter trace, or payer claim ref).",
    };
  }

  const receivedAt = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.claim837EdiSubmission.create({
      data: {
        tenantId: ctx.tenant.id,
        claimId: claim.id,
        interchangeControlNumber: interchangeControlNumber || null,
        groupControlNumber: groupControlNumber || null,
        transactionSetControlNumber: transactionSetControlNumber || null,
        submitterTraceNumber: submitterTraceNumber || null,
        payerClaimControlRef: payerClaimControlRef || null,
        clearinghouseLabel,
        notes: notes || null,
        recordedByUserId: session.userId,
      },
    });

    const detailParts = [
      clearinghouseLabel,
      interchangeControlNumber && `ISA ${interchangeControlNumber}`,
      groupControlNumber && `GS ${groupControlNumber}`,
      transactionSetControlNumber && `ST ${transactionSetControlNumber}`,
      submitterTraceNumber && `trace ${submitterTraceNumber}`,
      payerClaimControlRef && `payer ref ${payerClaimControlRef}`,
    ].filter(Boolean);

    await tx.claimTimelineEvent.create({
      data: {
        claimId: claim.id,
        label: "837 submission recorded",
        detail: detailParts.join(" · "),
      },
    });

    await tx.claim.update({
      where: { id: claim.id },
      data: {
        ediRefs: mergeEdiRefs(claim.ediRefs, {
          last837RecordedAt: receivedAt,
          last837Clearinghouse: clearinghouseLabel,
          ...(interchangeControlNumber
            ? { last837Interchange: interchangeControlNumber }
            : {}),
          ...(groupControlNumber ? { last837Group: groupControlNumber } : {}),
          ...(transactionSetControlNumber
            ? { last837StControl: transactionSetControlNumber }
            : {}),
        }),
      },
    });
  });

  const requestId = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "connect.claim.edi837_submission_recorded",
      resource: "claim",
      metadata: {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        clearinghouseLabel,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "connect.claim.edi837_submission_recorded", {
    tenantId: ctx.tenant.id,
    orgSlug,
    claimId: claim.id,
    ...(requestId ? { requestId } : {}),
  });

  revalidatePath(`/o/${orgSlug}/connect/claims/${claimId}`);
  revalidatePath(`/o/${orgSlug}/connect`);
  return { ok: true };
}

export async function record837OutboundWithTransport(
  _prev: Record837OutboundState,
  formData: FormData,
): Promise<Record837OutboundState> {
  const session = await getSession();
  if (!session) return { error: "Sign in required." };

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const claimId = String(formData.get("claimId") ?? "").trim();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) return { error: "Organization not found or no access." };
  if (!ctx.effectiveModules.has(ModuleKey.CONNECT)) {
    return { error: "Connect is not enabled for this account." };
  }

  const allowed = await isTenantSettingsEditor(session, ctx.tenant.id);
  if (!allowed) {
    return {
      error:
        "Only tenant admins or platform super admins can record outbound 837 payloads.",
    };
  }

  if (!claimId) {
    return { error: "Missing claim." };
  }

  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId: ctx.tenant.id },
  });
  if (!claim) {
    return { error: "Claim not found." };
  }

  const x12 = String(formData.get("x12Payload") ?? "").trim();
  const clearinghouseLabel = String(
    formData.get("outboundClearinghouseLabel") ?? "",
  ).trim();
  const doHttp = formData.get("doHttpTransport") === "on";

  if (!x12 || !clearinghouseLabel) {
    return {
      error: "X12 payload and clearinghouse / partner label are required.",
    };
  }
  if (!x12.includes("ISA*") || !x12.includes("ST*837")) {
    return {
      error: "Payload must include ISA* and ST*837 segments.",
    };
  }

  const hints = extractOutbound837ControlHints(splitX12Segments(x12));
  if (
    !hints.interchangeControlNumber &&
    !hints.groupControlNumber &&
    !hints.transactionSetControlNumber
  ) {
    return {
      error:
        "Could not read ISA/GS/ST control numbers from the payload (check segment format).",
    };
  }

  if (doHttp && !isEdiOutboundHttpConfigured()) {
    return {
      error:
        "HTTP transport is not configured. Set EDI_OUTBOUND_HTTP_ENABLED=true and EDI_OUTBOUND_HTTP_URL.",
    };
  }

  const structuralValidation = validateX12Structure(x12, {
    expect837Professional: true,
  });
  if (x12ValidationHasErrors(structuralValidation)) {
    const msgs = structuralValidation.issues
      .filter((i) => i.severity === "error")
      .map((i) => `${i.code}: ${i.message}`);
    return {
      error: `X12 structural validation failed — ${msgs.join(" · ")}`,
    };
  }

  const receivedAt = new Date().toISOString();

  const { submissionId, baseMetadata } = await prisma.$transaction(
    async (tx) => {
      const recorded = await createIngestionBatchRecordingRawPayload(tx, {
        tenantId: ctx.tenant.id,
        connectorKind: "edi_outbound",
        sourceKind: "x12_837_outbound",
        rawText: x12,
        metadata: {
          path: "connect.record837OutboundWithTransport",
          orgSlug,
          claimId: claim.id,
          claimNumber: claim.claimNumber,
          requestHttpTransport: doHttp,
        },
      });

      const baseMetadata = {
        outboundIngestionBatchId: recorded.batch.id,
        outboundSourceArtifactId: recorded.artifact.id,
        inlinePayloadStored: recorded.inlinePayloadStored,
        externalStorageStored: recorded.externalStorageStored,
        ...(recorded.artifact.storageUri
          ? { storageUri: recorded.artifact.storageUri }
          : {}),
      };

      const sub = await tx.claim837EdiSubmission.create({
        data: {
          tenantId: ctx.tenant.id,
          claimId: claim.id,
          interchangeControlNumber: hints.interchangeControlNumber,
          groupControlNumber: hints.groupControlNumber,
          transactionSetControlNumber: hints.transactionSetControlNumber,
          clearinghouseLabel,
          notes: doHttp
            ? "Outbound artifact stored; HTTP transport pending."
            : "Outbound artifact stored (record-only).",
          recordedByUserId: session.userId,
          metadata: baseMetadata as Prisma.InputJsonValue,
        },
        select: { id: true },
      });

      const detailParts = [
        clearinghouseLabel,
        "outbound X12",
        hints.interchangeControlNumber && `ISA ${hints.interchangeControlNumber}`,
        hints.groupControlNumber && `GS ${hints.groupControlNumber}`,
        hints.transactionSetControlNumber &&
          `ST ${hints.transactionSetControlNumber}`,
        `batch ${recorded.batch.id.slice(0, 8)}…`,
      ].filter(Boolean);

      await tx.claimTimelineEvent.create({
        data: {
          claimId: claim.id,
          label: doHttp
            ? "837 outbound payload stored (HTTP next)"
            : "837 outbound payload stored",
          detail: detailParts.join(" · "),
        },
      });

      await tx.claim.update({
        where: { id: claim.id },
        data: {
          ediRefs: mergeEdiRefs(claim.ediRefs, {
            last837RecordedAt: receivedAt,
            last837Clearinghouse: clearinghouseLabel,
            ...(hints.interchangeControlNumber
              ? { last837Interchange: hints.interchangeControlNumber }
              : {}),
            ...(hints.groupControlNumber
              ? { last837Group: hints.groupControlNumber }
              : {}),
            ...(hints.transactionSetControlNumber
              ? { last837StControl: hints.transactionSetControlNumber }
              : {}),
            last837OutboundBatchId: recorded.batch.id,
          }),
        },
      });

      return { submissionId: sub.id, baseMetadata };
    },
  );

  let httpOk: boolean | undefined;
  let httpStatus: number | undefined;

  if (doHttp) {
    try {
      const http = await postEdiOutboundX12Http(x12);
      httpOk = http.ok;
      httpStatus = http.status;
      await prisma.claim837EdiSubmission.update({
        where: { id: submissionId },
        data: {
          metadata: {
            ...baseMetadata,
            httpTransport: {
              ok: http.ok,
              status: http.status,
              attemptedAt: http.attemptedAt,
              responsePreview: http.responsePreview,
            },
          } as Prisma.InputJsonValue,
        },
      });
      await prisma.claimTimelineEvent.create({
        data: {
          claimId: claim.id,
          label: http.ok
            ? "837 HTTP transport accepted by endpoint"
            : "837 HTTP transport error",
          detail: `HTTP ${http.status}${
            http.responsePreview ? ` · ${http.responsePreview.slice(0, 180)}` : ""
          }`,
        },
      });
    } catch (e) {
      httpOk = false;
      httpStatus = 0;
      const message = e instanceof Error ? e.message : "HTTP request failed";
      await prisma.claim837EdiSubmission.update({
        where: { id: submissionId },
        data: {
          metadata: {
            ...baseMetadata,
            httpTransport: {
              ok: false,
              status: 0,
              attemptedAt: new Date().toISOString(),
              responsePreview: message,
            },
          } as Prisma.InputJsonValue,
        },
      });
      await prisma.claimTimelineEvent.create({
        data: {
          claimId: claim.id,
          label: "837 HTTP transport failed",
          detail: message,
        },
      });
    }
  }

  const requestId = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId: ctx.tenant.id,
      actorUserId: session.userId,
      action: "connect.claim.edi837_outbound_recorded",
      resource: "claim",
      metadata: {
        claimId: claim.id,
        claimNumber: claim.claimNumber,
        clearinghouseLabel,
        httpTransport: doHttp,
        ...(httpOk != null ? { httpOk, httpStatus } : {}),
        submissionId,
        ...(requestId ? { requestId } : {}),
      },
    },
  });

  platformLog("info", "connect.claim.edi837_outbound_recorded", {
    tenantId: ctx.tenant.id,
    orgSlug,
    claimId: claim.id,
    doHttp,
    ...(httpOk != null ? { httpOk, httpStatus } : {}),
    ...(requestId ? { requestId } : {}),
  });

  revalidatePath(`/o/${orgSlug}/connect/claims/${claimId}`);
  revalidatePath(`/o/${orgSlug}/connect`);
  return {
    ok: true,
    ...(httpOk != null ? { httpOk, httpStatus } : {}),
  };
}

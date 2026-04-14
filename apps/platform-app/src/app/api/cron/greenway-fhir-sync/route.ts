import {
  MAX_GREENWAY_CRON_PATIENT_IDS,
  resolveGreenwayFhirEnvConfigAsync,
  resolveGreenwayFhirEnvConfigAsyncForTenant,
  resolveGreenwayCronBulkPatientIdsEnvOnly,
  resolveGreenwayCronBulkPatientIdsForTenant,
} from "@/lib/connectors/greenway-fhir";
import { GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION } from "@/lib/connectors/greenway-fhir/audit-actions";
import { NextResponse } from "next/server";

/** Allow bulk Greenway sync enough time on Vercel (pilot: small allowlist). Tune with plan limits. */
export const maxDuration = 120;

const PREVIEW_MAX = 8000;

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function jsonPreview(body: unknown): string | null {
  if (body === null || body === undefined) {
    return null;
  }
  try {
    const s = JSON.stringify(body, null, 2);
    if (s.length <= PREVIEW_MAX) {
      return s;
    }
    return `${s.slice(0, PREVIEW_MAX)}\n…`;
  } catch {
    return null;
  }
}

/** Structured log line for operators — no patient identifiers or response bodies. */
function cronLog(
  level: "info" | "warn",
  event: string,
  fields: Record<string, string | number | boolean | null>,
): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...fields });
  if (level === "warn") {
    console.warn(`[greenway-fhir-cron] ${line}`);
  } else {
    console.info(`[greenway-fhir-cron] ${line}`);
  }
}

/**
 * Secured Greenway FHIR cron handler. Requires CRON_SECRET and
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron–compatible).
 *
 * - **`?tenantSlug=`** (optional): per-tenant Greenway config. Falls back to
 *   **`GREENWAY_FHIR_SYNC_TENANT_SLUG`**.
 * - **`?patientId=`** + tenant: **single** persist sync (+ audit).
 * - **No `patientId`** but bulk allowlist (tenant **`connectors.greenwayFhir.cronSyncPatientIds`**
 *   when non-empty, else **`GREENWAY_FHIR_CRON_PATIENT_IDS`**) + tenant:
 *   **bulk** sync (+ audit per id).
 * - **`?patientId=`** without tenant slug: **probe-only** Patient read.
 */
async function handleCron(req: Request) {
  if (!authorizeCron(req)) {
    if (!process.env.CRON_SECRET?.trim()) {
      cronLog("warn", "auth_missing_cron_secret", {});
      return NextResponse.json(
        { error: "CRON_SECRET is not set on the server." },
        { status: 503 },
      );
    }
    cronLog("warn", "auth_unauthorized", {});
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get("patientId")?.trim() || null;
  const tenantSlugParam = url.searchParams.get("tenantSlug")?.trim() || null;
  const syncTenantSlug =
    tenantSlugParam ||
    process.env.GREENWAY_FHIR_SYNC_TENANT_SLUG?.trim() ||
    null;

  const ranAt = new Date().toISOString();
  const { prisma, tenantPrisma } = await import("@/lib/prisma");
  /** When `syncTenantSlug` is set, persist reads/writes use that slug’s DB (`DATABASE_URL__…` if configured). */
  let tenantSyncDb = prisma;

  let tenantRow: {
    id: string;
    slug: string;
    settings: unknown;
  } | null = null;

  let cfg = await resolveGreenwayFhirEnvConfigAsync();

  if (syncTenantSlug) {
    tenantSyncDb = tenantPrisma(syncTenantSlug);
    const t = await tenantSyncDb.tenant.findUnique({
      where: { slug: syncTenantSlug },
      select: { id: true, slug: true, settings: true },
    });
    if (!t) {
      cronLog("warn", "tenant_slug_not_found", { tenantSlug: syncTenantSlug });
      return NextResponse.json(
        { error: `tenantSlug not found: ${syncTenantSlug}` },
        { status: 400 },
      );
    }
    tenantRow = t;
    const tenantCfg = await resolveGreenwayFhirEnvConfigAsyncForTenant(
      t.slug,
      t.settings,
    );
    if (!tenantCfg?.baseUrl) {
      return NextResponse.json(
        {
          error: `Greenway FHIR base URL not configured for tenant ${syncTenantSlug} (settings + env).`,
        },
        { status: 422 },
      );
    }
    cfg = tenantCfg;
  }

  const allowlistResolution =
    syncTenantSlug && tenantRow
      ? resolveGreenwayCronBulkPatientIdsForTenant({
          tenantSettings: tenantRow.settings,
        })
      : resolveGreenwayCronBulkPatientIdsEnvOnly();
  const bulkPatientIds = allowlistResolution.ids;
  const allowlistSource = allowlistResolution.source;

  if (bulkPatientIds.length > 0 && !syncTenantSlug) {
    cronLog("warn", "bulk_allowlist_missing_tenant", {
      bulkIdCount: bulkPatientIds.length,
    });
    return NextResponse.json(
      {
        ok: false,
        ranAt,
        mode: "bulk_missing_tenant",
        error:
          "Bulk allowlist is configured (env) but no tenant slug. Set GREENWAY_FHIR_SYNC_TENANT_SLUG or pass ?tenantSlug= on the cron URL.",
        greenway: {
          baseConfigured: Boolean(cfg?.baseUrl),
          tokenConfigured: Boolean(cfg?.accessToken),
          bulkIdCount: bulkPatientIds.length,
          allowlistSource,
        },
      },
      { status: 422 },
    );
  }

  if (
    bulkPatientIds.length > 0 &&
    syncTenantSlug &&
    tenantRow &&
    (!cfg?.accessToken || !cfg?.baseUrl)
  ) {
    cronLog("warn", "bulk_allowlist_incomplete_greenway_env", {
      tenantSlug: syncTenantSlug,
      bulkIdCount: bulkPatientIds.length,
      baseConfigured: Boolean(cfg?.baseUrl),
      tokenConfigured: Boolean(cfg?.accessToken),
    });
    return NextResponse.json(
      {
        ok: false,
        ranAt,
        mode: "bulk_incomplete_greenway_auth",
        tenantSlug: syncTenantSlug,
        bulkIdCount: bulkPatientIds.length,
        error:
          "Bulk allowlist is configured but Greenway base URL or access token is not available for this tenant (settings + env).",
      },
      { status: 422 },
    );
  }

  if (
    !patientId &&
    bulkPatientIds.length > 0 &&
    syncTenantSlug &&
    tenantRow &&
    cfg?.accessToken &&
    cfg.baseUrl
  ) {
    const { syncGreenwayPatientEncounters } = await import(
      "@/lib/connectors/greenway-fhir/sync-greenway-patient-encounters"
    );

    const results: Array<{
      patientLogicalId: string;
      ok: boolean;
      error?: string;
      anangPatientId?: string;
      encountersUpserted?: number;
      ingestionBatchId?: string;
    }> = [];

    for (const fid of bulkPatientIds) {
      const syncResult = await syncGreenwayPatientEncounters(tenantSyncDb, {
        tenantId: tenantRow.id,
        config: cfg,
        fhirPatientLogicalId: fid,
      });
      const ok = syncResult.ok;
      await tenantSyncDb.auditEvent.create({
        data: {
          tenantId: tenantRow.id,
          actorUserId: null,
          action: GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION,
          resource: "external_fhir",
          metadata: {
            patientLogicalId: fid,
            syncOk: ok,
            ...(ok
              ? {
                  anangPatientId: syncResult.anangPatientId,
                  encountersUpserted: syncResult.encountersUpserted,
                  ingestionBatchId: syncResult.ingestionBatchId,
                  warningCount: syncResult.warnings.length,
                }
              : { error: syncResult.error }),
            source: "cron_bulk_env",
          },
        },
      });
      if (ok) {
        results.push({
          patientLogicalId: fid,
          ok: true,
          anangPatientId: syncResult.anangPatientId,
          encountersUpserted: syncResult.encountersUpserted,
          ingestionBatchId: syncResult.ingestionBatchId,
        });
      } else {
        results.push({
          patientLogicalId: fid,
          ok: false,
          error: syncResult.error,
        });
      }
    }

    const failedCount = results.filter((r) => !r.ok).length;
    cronLog(failedCount > 0 ? "warn" : "info", "bulk_sync_finished", {
      tenantSlug: syncTenantSlug ?? "",
      patientCount: bulkPatientIds.length,
      failedCount,
      ok: failedCount === 0,
      allowlistSource,
    });
    return NextResponse.json({
      ok: failedCount === 0,
      stub: false,
      sync: true,
      bulk: true,
      ranAt,
      tenantSlug: syncTenantSlug,
      patientCount: bulkPatientIds.length,
      allowlistSource,
      allowlistMax: MAX_GREENWAY_CRON_PATIENT_IDS,
      failedCount,
      results,
      note: "Bulk sync from tenant allowlist or GREENWAY_FHIR_CRON_PATIENT_IDS. One audit event per id.",
    });
  }

  if (patientId && cfg?.accessToken && cfg.baseUrl) {
    if (syncTenantSlug && tenantRow) {
      const { syncGreenwayPatientEncounters } = await import(
        "@/lib/connectors/greenway-fhir/sync-greenway-patient-encounters"
      );
      const syncResult = await syncGreenwayPatientEncounters(tenantSyncDb, {
        tenantId: tenantRow.id,
        config: cfg,
        fhirPatientLogicalId: patientId,
      });

      await tenantSyncDb.auditEvent.create({
        data: {
          tenantId: tenantRow.id,
          actorUserId: null,
          action: GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION,
          resource: "external_fhir",
          metadata: {
            patientLogicalId: patientId,
            syncOk: syncResult.ok,
            ...(syncResult.ok
              ? {
                  anangPatientId: syncResult.anangPatientId,
                  encountersUpserted: syncResult.encountersUpserted,
                  ingestionBatchId: syncResult.ingestionBatchId,
                  warningCount: syncResult.warnings.length,
                }
              : { error: syncResult.error }),
            source: "cron_query_patientId",
          },
        },
      });

      if (!syncResult.ok) {
        cronLog("warn", "single_patient_sync_failed", {
          tenantSlug: syncTenantSlug ?? "",
        });
        return NextResponse.json(
          {
            ok: false,
            ranAt,
            patientId,
            tenantSlug: syncTenantSlug,
            error: syncResult.error,
          },
          { status: 422 },
        );
      }
      cronLog("info", "single_patient_sync_ok", {
        tenantSlug: syncTenantSlug ?? "",
        encountersUpserted: syncResult.encountersUpserted,
      });
      return NextResponse.json({
        ok: true,
        stub: false,
        sync: true,
        ranAt,
        patientId,
        tenantSlug: syncTenantSlug,
        anangPatientId: syncResult.anangPatientId,
        encountersUpserted: syncResult.encountersUpserted,
        encounterAnangIds: syncResult.encounterAnangIds,
        ingestionBatchId: syncResult.ingestionBatchId,
        warnings: syncResult.warnings,
        note: "Patient + Encounters upserted into canonical tables (pilot worker).",
      });
    }

    const { greenwayFhirGetResource } = await import(
      "@/lib/connectors/greenway-fhir/client"
    );
    const res = await greenwayFhirGetResource(cfg, "Patient", patientId);
    return NextResponse.json({
      ok: res.ok,
      stub: false,
      probeOnly: true,
      ranAt,
      httpStatus: res.status,
      patientId,
      tenantSlug: syncTenantSlug,
      bodyPreview: jsonPreview(res.body),
      note: syncTenantSlug
        ? "Probe only — add tenantSlug that exists and matches config to persist, or call without tenantSlug for global probe."
        : "Probe only (no DB). Pass tenantSlug (or set GREENWAY_FHIR_SYNC_TENANT_SLUG) to persist Patient + Encounters.",
    });
  }

  const noopReason =
    patientId && !cfg?.accessToken
      ? "missing_greenway_token"
      : patientId
        ? "patient_probe_incomplete"
        : bulkPatientIds.length === 0
          ? "empty_allowlist_no_patientId"
          : "fallback_noop";

  cronLog("info", "scheduled_noop", {
    mode: noopReason,
    tenantSlugSet: Boolean(syncTenantSlug),
    bulkIdCount: bulkPatientIds.length,
    patientIdParam: Boolean(patientId),
  });

  return NextResponse.json({
    ok: true,
    stub: true,
    ranAt,
    mode: noopReason,
    greenway: {
      baseConfigured: Boolean(cfg?.baseUrl),
      tokenConfigured: Boolean(cfg?.accessToken),
      tenantSlug: syncTenantSlug,
      bulkIdsConfigured: bulkPatientIds.length > 0,
      bulkIdCount: bulkPatientIds.length,
      allowlistSource,
      allowlistMax: MAX_GREENWAY_CRON_PATIENT_IDS,
    },
    hint:
      patientId && !cfg?.accessToken
        ? "Set GREENWAY_FHIR_ACCESS_TOKEN (global or __SLUG) or OAuth client-credentials env vars."
        : patientId
          ? "Auth/env incomplete for patient probe."
          : bulkPatientIds.length === 0
            ? "No patientId and bulk allowlist is empty (tenant connectors.greenwayFhir.cronSyncPatientIds and GREENWAY_FHIR_CRON_PATIENT_IDS) — scheduled run did not sync. Use hub manual sync for one-off patients."
            : "Unexpected noop — check tenant and Greenway configuration.",
  });
}

export function GET(req: Request) {
  return handleCron(req);
}

export function POST(req: Request) {
  return handleCron(req);
}

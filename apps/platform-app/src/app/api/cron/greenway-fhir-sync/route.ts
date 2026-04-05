import {
  resolveGreenwayFhirEnvConfigAsync,
  resolveGreenwayFhirEnvConfigAsyncForTenant,
} from "@/lib/connectors/greenway-fhir";
import { GREENWAY_FHIR_CRON_SYNC_AUDIT_ACTION } from "@/lib/connectors/greenway-fhir/audit-actions";
import { NextResponse } from "next/server";

const PREVIEW_MAX = 8000;
const MAX_BULK_PATIENT_IDS = 30;

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

/** Comma/semicolon/newline-separated FHIR Patient logical ids (pilot backfill). */
function parseBulkPatientIdsFromEnv(): string[] {
  const raw = process.env.GREENWAY_FHIR_CRON_PATIENT_IDS?.trim();
  if (!raw) return [];
  const ids = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(ids)].slice(0, MAX_BULK_PATIENT_IDS);
}

/**
 * Secured Greenway FHIR cron handler. Requires CRON_SECRET and
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron–compatible).
 *
 * - **`?tenantSlug=`** (optional): per-tenant Greenway config. Falls back to
 *   **`GREENWAY_FHIR_SYNC_TENANT_SLUG`**.
 * - **`?patientId=`** + tenant: **single** persist sync (+ audit).
 * - **No `patientId`** but **`GREENWAY_FHIR_CRON_PATIENT_IDS`** env set + tenant:
 *   **bulk** sync (+ audit per id).
 * - **`?patientId=`** without tenant slug: **probe-only** Patient read.
 */
async function handleCron(req: Request) {
  if (!authorizeCron(req)) {
    if (!process.env.CRON_SECRET?.trim()) {
      return NextResponse.json(
        { error: "CRON_SECRET is not set on the server." },
        { status: 503 },
      );
    }
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

  const bulkPatientIds = parseBulkPatientIdsFromEnv();

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
    return NextResponse.json({
      ok: failedCount === 0,
      stub: false,
      sync: true,
      bulk: true,
      ranAt,
      tenantSlug: syncTenantSlug,
      patientCount: bulkPatientIds.length,
      failedCount,
      results,
      note: "Bulk sync from GREENWAY_FHIR_CRON_PATIENT_IDS. One audit event per id.",
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

  return NextResponse.json({
    ok: true,
    stub: true,
    ranAt,
    greenway: {
      baseConfigured: Boolean(cfg?.baseUrl),
      tokenConfigured: Boolean(cfg?.accessToken),
      tenantSlug: syncTenantSlug,
      bulkIdsConfigured: bulkPatientIds.length > 0,
      bulkIdCount: bulkPatientIds.length,
    },
    hint:
      patientId && !cfg?.accessToken
        ? "Set GREENWAY_FHIR_ACCESS_TOKEN (global or __SLUG) or OAuth client-credentials env vars."
        : patientId
          ? "Auth/env incomplete for patient probe."
          : bulkPatientIds.length && !syncTenantSlug
            ? "Set tenantSlug or GREENWAY_FHIR_SYNC_TENANT_SLUG to run bulk sync from GREENWAY_FHIR_CRON_PATIENT_IDS."
            : "No patientId and no bulk list — noop. Use ?patientId=, or set GREENWAY_FHIR_CRON_PATIENT_IDS for scheduled backfill.",
  });
}

export function GET(req: Request) {
  return handleCron(req);
}

export function POST(req: Request) {
  return handleCron(req);
}

/**
 * Pilot Greenway cron bulk-sync allowlist: env and/or Tenant.settings JSON.
 * Precedence when tenant context is loaded: non-empty tenant list wins; else env.
 */

export const MAX_GREENWAY_CRON_PATIENT_IDS = 30;

/** FHIR logical id — conservative (avoids commas/newlines already split out). */
const PATIENT_LOGICAL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export type GreenwayCronAllowlistSource = "tenant" | "env" | "none";

export type GreenwayCronAllowlistResolution = {
  ids: string[];
  source: GreenwayCronAllowlistSource;
  /** Entries dropped by validation (not logged with values). */
  invalidDropped: number;
};

function normalizeOneId(raw: string): string | null {
  const s = raw.trim();
  if (!s || !PATIENT_LOGICAL_ID_RE.test(s)) return null;
  return s;
}

function finalizeIds(candidates: string[]): {
  ids: string[];
  invalidDropped: number;
} {
  const seen = new Set<string>();
  const ids: string[] = [];
  let invalidDropped = 0;
  for (const c of candidates) {
    const n = normalizeOneId(c);
    if (!n) {
      if (c.trim()) invalidDropped += 1;
      continue;
    }
    if (seen.has(n)) continue;
    seen.add(n);
    ids.push(n);
    if (ids.length >= MAX_GREENWAY_CRON_PATIENT_IDS) break;
  }
  return { ids, invalidDropped };
}

/** Split env-style string: comma, semicolon, or newline. */
export function parseGreenwayCronPatientIdsFromDelimitedString(
  raw: string,
): GreenwayCronAllowlistResolution {
  const ids = raw
    .split(/[,;\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const { ids: out, invalidDropped } = finalizeIds(ids);
  return {
    ids: out,
    source: out.length > 0 ? "env" : "none",
    invalidDropped,
  };
}

function parseFromTenantGreenwayObject(
  gw: Record<string, unknown>,
): GreenwayCronAllowlistResolution {
  const raw = gw.cronSyncPatientIds;
  const candidates: string[] = [];
  if (typeof raw === "string" && raw.trim()) {
    candidates.push(
      ...raw
        .split(/[,;\r\n]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    );
  } else if (Array.isArray(raw)) {
    for (const x of raw) {
      if (typeof x === "string" && x.trim()) candidates.push(x);
    }
  }
  const { ids: out, invalidDropped } = finalizeIds(candidates);
  return {
    ids: out,
    source: out.length > 0 ? "tenant" : "none",
    invalidDropped,
  };
}

function greenwayConnectorObject(
  tenantSettings: unknown,
): Record<string, unknown> | null {
  if (!tenantSettings || typeof tenantSettings !== "object") return null;
  const root = tenantSettings as Record<string, unknown>;
  const connectors = root.connectors;
  if (!connectors || typeof connectors !== "object") return null;
  const gw = (connectors as Record<string, unknown>).greenwayFhir;
  if (!gw || typeof gw !== "object") return null;
  return gw as Record<string, unknown>;
}

/** Read allowlist from `Tenant.settings.connectors.greenwayFhir.cronSyncPatientIds` only. */
export function parseGreenwayCronPatientIdsFromTenantSettings(
  tenantSettings: unknown,
): GreenwayCronAllowlistResolution {
  const gw = greenwayConnectorObject(tenantSettings);
  if (!gw) {
    return { ids: [], source: "none", invalidDropped: 0 };
  }
  return parseFromTenantGreenwayObject(gw);
}

/** Env string only (no tenant merge). */
export function parseGreenwayCronPatientIdsFromProcessEnv(): GreenwayCronAllowlistResolution {
  const raw = process.env.GREENWAY_FHIR_CRON_PATIENT_IDS?.trim() ?? "";
  if (!raw) return { ids: [], source: "none", invalidDropped: 0 };
  return parseGreenwayCronPatientIdsFromDelimitedString(raw);
}

/**
 * Resolve bulk ids when cron has a loaded tenant row.
 * Precedence: non-empty **`cronSyncPatientIds`** in tenant Greenway settings; else **`GREENWAY_FHIR_CRON_PATIENT_IDS`** env.
 */
export function resolveGreenwayCronBulkPatientIdsForTenant(args: {
  tenantSettings: unknown;
}): GreenwayCronAllowlistResolution {
  const tenantRes = parseGreenwayCronPatientIdsFromTenantSettings(
    args.tenantSettings,
  );
  if (tenantRes.ids.length > 0) {
    return tenantRes;
  }
  const envRes = parseGreenwayCronPatientIdsFromProcessEnv();
  return {
    ids: envRes.ids,
    source: envRes.ids.length > 0 ? "env" : "none",
    invalidDropped: tenantRes.invalidDropped + envRes.invalidDropped,
  };
}

/**
 * When cron has no tenant slug, only env allowlist applies.
 */
export function resolveGreenwayCronBulkPatientIdsEnvOnly(): GreenwayCronAllowlistResolution {
  return parseGreenwayCronPatientIdsFromProcessEnv();
}

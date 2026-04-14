import type { GreenwayCronAllowlistSource } from "@/lib/connectors/greenway-fhir";

export function GreenwayCronAllowlistSummary({
  allowlistSource,
  allowlistCount,
  allowlistMax,
  invalidDropped,
  cronSecretConfigured,
  cronDefaultTenantSlug,
  orgSlug,
  greenwayReady,
}: {
  allowlistSource: GreenwayCronAllowlistSource;
  allowlistCount: number;
  allowlistMax: number;
  invalidDropped: number;
  cronSecretConfigured: boolean;
  cronDefaultTenantSlug: string | null;
  orgSlug: string;
  greenwayReady: boolean;
}) {
  const sourceLabel =
    allowlistSource === "tenant"
      ? "Tenant settings (connectors.greenwayFhir.cronSyncPatientIds)"
      : allowlistSource === "env"
        ? "Deployment env (GREENWAY_FHIR_CRON_PATIENT_IDS)"
        : "None (empty)";

  const cronTenantMatches =
    cronDefaultTenantSlug != null &&
    cronDefaultTenantSlug.toLowerCase() === orgSlug.toLowerCase();

  const cronLikelyReady =
    cronSecretConfigured &&
    greenwayReady &&
    allowlistCount > 0 &&
    cronTenantMatches;

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700">
      <p className="font-semibold text-slate-900">Scheduled cron sync (pilot)</p>
      <ul className="mt-2 list-inside list-disc space-y-1">
        <li>
          Allowlist source: <span className="font-medium">{sourceLabel}</span>
        </li>
        <li>
          Patient ids in allowlist:{" "}
          <span className="font-mono font-medium">
            {allowlistCount}
          </span>{" "}
          (max {allowlistMax})
        </li>
        {invalidDropped > 0 ? (
          <li className="text-amber-800">
            Invalid entries dropped during parse: {invalidDropped} (check format)
          </li>
        ) : null}
        <li>
          CRON_SECRET on server:{" "}
          <span className="font-medium">
            {cronSecretConfigured ? "set" : "not set"}
          </span>
        </li>
        <li>
          Default cron tenant slug env:{" "}
          <span className="font-mono">
            {cronDefaultTenantSlug ?? "(not set)"}
          </span>
          {cronDefaultTenantSlug ? (
            <>
              {" "}
              —{" "}
              {cronTenantMatches ? (
                <span className="text-emerald-800">matches this org</span>
              ) : (
                <span className="text-amber-800">does not match this org</span>
              )}
            </>
          ) : null}
        </li>
        <li>
          Cron bulk sync likely ready for <strong>this</strong> org:{" "}
          <span
            className={
              cronLikelyReady ? "font-medium text-emerald-800" : "font-medium text-amber-800"
            }
          >
            {cronLikelyReady ? "yes" : "no"}
          </span>
        </li>
      </ul>
      {!cronLikelyReady ? (
        <p className="mt-2 text-slate-600">
          Fix Greenway env, set allowlist on this tenant or in env, set{" "}
          <span className="font-mono">CRON_SECRET</span>, and align{" "}
          <span className="font-mono">GREENWAY_FHIR_SYNC_TENANT_SLUG</span> with
          this org slug for the 15-minute job to sync this tenant automatically.
        </p>
      ) : null}
    </div>
  );
}

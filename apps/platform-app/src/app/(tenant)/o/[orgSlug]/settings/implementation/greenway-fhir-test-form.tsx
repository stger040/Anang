"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  submitGreenwayFhirHubForm,
  type GreenwayFhirHubFormState,
} from "../actions";

export function GreenwayFhirTestForm({
  orgSlug,
  canEdit,
  greenwayEnvStatus,
}: {
  orgSlug: string;
  canEdit: boolean;
  greenwayEnvStatus: "missing" | "no_token" | "ready";
}) {
  const [state, formAction, pending] = useActionState<
    GreenwayFhirHubFormState,
    FormData
  >(submitGreenwayFhirHubForm, null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const testOk = state?.intent === "test" && state.result && "ok" in state.result && state.result.ok;
    const syncOk =
      state?.intent === "sync" && state.result && "ok" in state.result && state.result.ok;
    if ((testOk || syncOk) && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [state]);

  if (!canEdit) {
    return null;
  }

  const testResult = state?.intent === "test" ? state.result : null;
  const syncResult = state?.intent === "sync" ? state.result : null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
        Greenway FHIR API — connectivity & sync
      </h3>
      <p className="text-xs text-slate-600">
        Uses merged config: global <span className="font-mono">GREENWAY_FHIR_*</span>{" "}
        plus optional{" "}
        <span className="font-mono">Tenant.settings.connectors.greenwayFhir</span>{" "}
        and per-tenant secrets{" "}
        <span className="font-mono">GREENWAY_FHIR_ACCESS_TOKEN__&lt;SLUG&gt;</span>{" "}
        (see <span className="font-mono">DEPLOYMENT.md</span>).{" "}
        <a
          className="text-brand-navy underline"
          href="https://developers.greenwayhealth.com/developer-platform/reference/getting-started-1"
          target="_blank"
          rel="noreferrer"
        >
          Greenway docs
        </a>
        . BAA-covered staging only.
      </p>
      {greenwayEnvStatus === "missing" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          FHIR base not resolved: set global{" "}
          <span className="font-mono">GREENWAY_FHIR_BASE_URL</span> (or{" "}
          <span className="font-mono">TENANT_ID</span> +{" "}
          <span className="font-mono">GREENWAY_FHIR_ENV</span>) and/or{" "}
          <span className="font-mono">connectors.greenwayFhir</span> on this
          tenant.
        </p>
      ) : null}
      {greenwayEnvStatus === "no_token" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Base URL ok; add bearer token or OAuth trio for this tenant slug
          (suffixed env vars) or globally — see{" "}
          <span className="font-mono">.env.example</span>.
        </p>
      ) : null}

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <div>
          <label
            htmlFor="patientLogicalId"
            className="block text-xs font-medium text-slate-700"
          >
            Patient logical id
          </label>
          <input
            id="patientLogicalId"
            name="patientLogicalId"
            required
            disabled={greenwayEnvStatus !== "ready"}
            placeholder="e.g. 12345 (from vendor or staging)"
            className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy disabled:bg-slate-50"
          />
        </div>

        {testResult && "error" in testResult ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {testResult.error}
          </p>
        ) : null}
        {syncResult && "error" in syncResult ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {syncResult.error}
          </p>
        ) : null}

        {testResult && "ok" in testResult && testResult.ok ? (
          <div
            ref={noticeRef}
            tabIndex={-1}
            className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 outline-none"
          >
            <p className="text-xs font-semibold uppercase text-emerald-900">
              Test read
            </p>
            <p>
              <span className="font-semibold">HTTP {testResult.httpStatus}</span>{" "}
              — {testResult.summary.nameLine ?? "(no name)"} · id{" "}
              <span className="font-mono">{testResult.summary.logicalId}</span>
              {testResult.summary.birthDate
                ? ` · DOB ${testResult.summary.birthDate}`
                : ""}
              {testResult.summary.gender ? ` · ${testResult.summary.gender}` : ""}
            </p>
            {testResult.previewJson ? (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-emerald-900">
                  Raw JSON (truncated)
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded border border-emerald-200/80 bg-white/80 p-2 font-mono leading-snug text-slate-800">
                  {testResult.previewJson}
                </pre>
              </details>
            ) : null}
          </div>
        ) : null}

        {syncResult && "ok" in syncResult && syncResult.ok ? (
          <div
            ref={noticeRef}
            tabIndex={-1}
            className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 outline-none"
          >
            <p className="text-xs font-semibold uppercase text-emerald-900">
              Sync complete
            </p>
            <p>
              Patient <span className="font-mono">{syncResult.anangPatientId}</span>{" "}
              — {syncResult.encountersUpserted} encounter(s) upserted.
            </p>
            <p className="font-mono text-[10px] text-emerald-900">
              IngestionBatch {syncResult.ingestionBatchId}
            </p>
            {syncResult.warnings.length > 0 ? (
              <ul className="list-inside list-disc text-xs text-amber-950">
                {syncResult.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="intent"
            value="test"
            variant="secondary"
            size="sm"
            disabled={pending || greenwayEnvStatus !== "ready"}
          >
            {pending ? "Working…" : "Test Patient read"}
          </Button>
          <Button
            type="submit"
            name="intent"
            value="sync"
            variant="secondary"
            size="sm"
            disabled={pending || greenwayEnvStatus !== "ready"}
          >
            {pending ? "Working…" : "Sync Patient + Encounters"}
          </Button>
        </div>
      </form>
    </div>
  );
}

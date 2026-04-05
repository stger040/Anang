"use client";

import { Button } from "@anang/ui";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  importFhirFixtureFromSettings,
  type SettingsActionState,
} from "../actions";

export function FhirImportForm({
  orgSlug,
  canEdit,
  buildEnabled,
  payEnabled,
}: {
  orgSlug: string;
  canEdit: boolean;
  buildEnabled: boolean;
  payEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    SettingsActionState,
    FormData
  >(importFhirFixtureFromSettings, null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [state]);

  if (!canEdit) {
    return null;
  }

  if (!buildEnabled) {
    return (
      <p className="text-sm text-slate-600">
        Enable the <span className="font-mono">BUILD</span> module for this
        tenant (super admin → entitlements) to import test encounters here.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <div>
        <label
          htmlFor="bundleJson"
          className="block text-xs font-medium text-slate-700"
        >
          FHIR R4 Bundle (JSON)
        </label>
        <p className="mt-1 text-xs text-slate-500">
          Paste a Bundle containing at least one Patient and one Encounter
          (e.g. Synthea export or vendor test bundle). A minimal USD Claim
          example ships in the repo at{" "}
          <span className="font-mono">
            fixtures/fhir/minimal-patient-encounter-claim.example.json
          </span>{" "}
          (under <span className="font-mono">apps/platform-app</span>). Max 2MB.
          Creates patient, encounter, and optional Pay rows in this tenant.
          {payEnabled ? (
            <>
              {" "}
              With <span className="font-mono">PAY</span> on, also creates an{" "}
              <strong>open statement</strong> for the same patient: if the bundle
              includes R4 <span className="font-mono">Claim</span>(s) for the
              patient with <span className="font-mono">item.net</span> lines,
              those become statement lines (multiple claims merge, up to 50
              lines / 20 resources; non-USD <span className="font-mono">Money</span>{" "}
              uses ISO 4217 minor units and tags descriptions).{" "}
              <span className="font-mono">ExplanationOfBenefit</span> entries
              for the patient are recorded on the encounter and in the import
              audit (no X12 835). Non-USD claim lines convert to USD cents using
              built-in reference FX rates or{" "}
              <span className="font-mono">FHIR_IMPORT_FX_RATES_JSON</span> in{" "}
              <span className="font-mono">.env</span>.{" "}
              <span className="font-mono">FHIR_IMPORT_FX_STRICT=1</span> fails
              the import when a rate is missing or claims are non-billable.
              Otherwise a single $250.00 fallback line is created.
            </>
          ) : null}
        </p>
        <textarea
          id="bundleJson"
          name="bundleJson"
          required
          rows={12}
          placeholder='{ "resourceType": "Bundle", "type": "collection", "entry": [ ... ] }'
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      </div>

      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <div
          ref={noticeRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none"
        >
          <p>
            Import complete. You can open the new visit and statement directly
            below.
            {state.payStatementCreated ? (
              <>
                {" "}
                Pay also created an open statement for this patient because{" "}
                <span className="font-mono">PAY</span> is on.
              </>
            ) : null}
            {state.fhirEobResourceCount != null && state.fhirEobResourceCount > 0 ? (
              <>
                {" "}
                Recorded{" "}
                <span className="font-medium">
                  {state.fhirEobResourceCount} ExplanationOfBenefit
                  {state.fhirEobResourceCount === 1 ? "" : "s"}
                </span>{" "}
                for operations trace (no 835 parsing).
              </>
            ) : null}
          </p>
          {state.importedEncounterId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/o/${orgSlug}/build/encounters/${state.importedEncounterId}`}
                className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-950 shadow-sm hover:bg-emerald-50/80"
              >
                Open encounter in Build
              </Link>
              {state.importedStatementId ? (
                <Link
                  href={`/o/${orgSlug}/pay/statements/${state.importedStatementId}`}
                  className="inline-flex items-center rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-950 shadow-sm hover:bg-emerald-50/80"
                >
                  Open statement in Pay
                </Link>
              ) : null}
              <Link
                href={`/o/${orgSlug}/build`}
                className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-100/50 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
              >
                Build queue
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Importing…" : "Import bundle"}
      </Button>
    </form>
  );
}

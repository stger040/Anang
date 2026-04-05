"use client";

import { CSV_ENCOUNTER_STATEMENT_V1_COLUMNS } from "@/lib/connectors/csv-fixture-import";
import { Button } from "@anang/ui";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";

import {
  importCsvFixtureFromSettings,
  type SettingsActionState,
} from "../actions";

const EXAMPLE_HINT = `patient_mrn,patient_first_name,patient_last_name,patient_dob,encounter_dos,statement_number,line_code,line_description,line_amount_cents
MRN-1,Pat,Example,1990-01-15,2026-03-01,STMT-A,99213,Office visit,15000`;

export function CsvImportForm({
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
  >(importCsvFixtureFromSettings, null);
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
    return null;
  }

  return (
    <form action={formAction} className="mt-6 space-y-3 border-t border-slate-100 pt-6">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
        CSV — encounter + statement lines
      </h3>
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <p className="text-xs text-slate-500">
        Strict header row (exact names, lowercase):{" "}
        <code className="rounded bg-slate-100 px-1 text-[10px]">
          {CSV_ENCOUNTER_STATEMENT_V1_COLUMNS.join(",")}
        </code>
        . One visit per file; repeat patient columns on every line. Example file:{" "}
        <span className="font-mono text-[10px]">
          fixtures/csv/minimal-encounter-statement.example.csv
        </span>
        . Statement number on Pay becomes{" "}
        <span className="font-mono">CSV-…</span>. Same idempotency rules as FHIR
        (external ids + replace lines when no payments).
        {payEnabled ? null : (
          <span className="block pt-1">
            <span className="font-mono">PAY</span> is off — encounter only, no
            statement.
          </span>
        )}
      </p>
      <textarea
        name="csvText"
        required
        rows={8}
        placeholder={EXAMPLE_HINT}
        spellCheck={false}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
      />

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
          <p>CSV import complete.</p>
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
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Importing…" : "Import CSV"}
      </Button>
    </form>
  );
}

"use client";

import { preview837pFromDraft } from "../../actions";
import type { X12ValidationResult } from "@/lib/connect/edi/validate-x12-structure";
import { Button } from "@anang/ui";
import { useState, useTransition } from "react";

export function Preview837pForm({
  draftId,
  orgSlug,
  disabled,
}: {
  draftId: string;
  orgSlug: string;
  disabled?: boolean;
}) {
  const [x12, setX12] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [structVal, setStructVal] = useState<X12ValidationResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          startTransition(async () => {
            const r = await preview837pFromDraft(fd);
            if (r.ok) {
              setX12(r.x12);
            } else {
              setX12(null);
              setError(r.error);
            }
          });
        }}
      >
        <input type="hidden" name="draftId" value={draftId} />
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <Button
          type="submit"
          disabled={disabled || pending}
          variant="secondary"
          size="sm"
        >
          {pending ? "Generating…" : "Preview 837P (no submit)"}
        </Button>
        <span className="text-xs text-slate-500">
          X12 for rehearsal; structural checks (E2b2b4) shown below.
        </span>
      </form>
      {structVal ? (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            structVal.ok
              ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
              : "border-amber-200 bg-amber-50/80 text-amber-950"
          }`}
        >
          <p className="font-medium">
            {structVal.ok ? "Structure check passed" : "Structure issues"}{" "}
            <span className="font-normal text-slate-600">
              · {structVal.guide} · {structVal.segmentCount} segments
            </span>
          </p>
          {structVal.issues.length > 0 ? (
            <ul className="mt-2 list-inside list-disc text-[11px] leading-relaxed">
              {structVal.issues.map((i) => (
                <li key={`${i.code}-${i.message.slice(0, 40)}`}>
                  <span className="font-mono">{i.code}</span> ({i.severity}):{" "}
                  {i.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {x12 ? (
        <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-[10px] leading-snug text-slate-100">
          {x12}
        </pre>
      ) : null}
    </div>
  );
}

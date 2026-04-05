"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  saveBuildRulePack,
  type BuildRulePackActionState,
} from "../actions";

const DEFAULT_PACK = `{
  "disabledRuleKeys": [],
  "severityOverrides": {},
  "notes": ""
}`;

export function BuildRulePackForm({
  orgSlug,
  initialJson,
  canEdit,
}: {
  orgSlug: string;
  initialJson: string;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    BuildRulePackActionState,
    FormData
  >(saveBuildRulePack, null);
  const bannerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok && bannerRef.current) {
      bannerRef.current.focus();
    }
  }, [state]);

  if (!canEdit) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Read-only: tenant admin permissions required to edit Build rule packs.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="orgSlug" value={orgSlug} />

      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p
          ref={bannerRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none"
        >
          Build rule pack saved. Visits to Build encounter pages will apply this
          calibration on the next load.
        </p>
      ) : null}

      <div>
        <label
          htmlFor="buildRulePackJson"
          className="block text-xs font-medium text-slate-700"
        >
          JSON calibration
        </label>
        <textarea
          id="buildRulePackJson"
          name="buildRulePackJson"
          rows={14}
          defaultValue={initialJson.trim() ? initialJson : DEFAULT_PACK}
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
        <p className="mt-2 text-xs text-slate-500">
          <strong className="text-slate-700">disabledRuleKeys</strong> — exact{" "}
          <code className="rounded bg-slate-100 px-1">ruleKey</code> or prefix
          ending in <code className="rounded bg-slate-100 px-1">*</code> (e.g.{" "}
          <code className="rounded bg-slate-100 px-1">
            build.cpt.required:*
          </code>
          ). <strong className="text-slate-700">severityOverrides</strong> —
          map base keys like{" "}
          <code className="rounded bg-slate-100 px-1">build.icd10.required</code>{" "}
          to <code className="rounded bg-slate-100 px-1">info</code>,{" "}
          <code className="rounded bg-slate-100 px-1">warning</code>, or{" "}
          <code className="rounded bg-slate-100 px-1">critical</code>. Applies to
          line-specific keys automatically. Core rule definitions come from
          code; this layer only filters and retunes severity. Not PHI.
        </p>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save Build rule pack"}
      </Button>
    </form>
  );
}

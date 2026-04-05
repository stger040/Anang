"use client";

import {
  deleteBuildKnowledgeChunk,
  upsertBuildKnowledgeChunk,
  type BuildKnowledgeChunkActionState,
} from "../actions";
import { Badge, Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export type KnowledgeChunkRow = {
  id: string;
  kind: string;
  lookupKey: string;
  title: string;
  body: string;
  sourceLabel: string | null;
};

function excerpt(s: string, max: number) {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function DeleteChunkForm({
  orgSlug,
  chunkId,
}: {
  orgSlug: string;
  chunkId: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    BuildKnowledgeChunkActionState,
    FormData
  >(deleteBuildKnowledgeChunk, null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="chunkId" value={chunkId} />
      {state && "error" in state ? (
        <p className="max-w-[12rem] text-right text-xs text-red-700">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Remove"}
      </Button>
    </form>
  );
}

export function BuildKnowledgeChunksPanel({
  orgSlug,
  chunks,
  canEdit,
}: {
  orgSlug: string;
  chunks: KnowledgeChunkRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [addState, addAction, addPending] = useActionState<
    BuildKnowledgeChunkActionState,
    FormData
  >(upsertBuildKnowledgeChunk, null);
  const addBannerRef = useRef<HTMLParagraphElement>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (addState && "ok" in addState && addState.ok) {
      addFormRef.current?.reset();
      router.refresh();
    }
  }, [addState, router]);

  useEffect(() => {
    if (addState && "ok" in addState && addState.ok && addBannerRef.current) {
      addBannerRef.current.focus();
    }
  }, [addState]);

  return (
    <div className="space-y-6">
      {chunks.length === 0 ? (
        <p className="text-sm text-slate-500">
          No snippets yet. Seed data may still add defaults; add rows here for
          pilot-specific reference text.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {chunks.map((ch) => (
            <li
              key={ch.id}
              className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{ch.kind.toUpperCase()}</Badge>
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                    {ch.lookupKey}
                  </code>
                  {ch.sourceLabel ? (
                    <span className="text-xs text-slate-500">
                      {ch.sourceLabel}
                    </span>
                  ) : null}
                </div>
                <p className="font-medium text-slate-900">{ch.title}</p>
                <p className="text-sm text-slate-600">{excerpt(ch.body, 220)}</p>
              </div>
              {canEdit ? (
                <DeleteChunkForm orgSlug={orgSlug} chunkId={ch.id} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <form ref={addFormRef} action={addAction} className="space-y-4 border-t border-slate-100 pt-6">
          <input type="hidden" name="orgSlug" value={orgSlug} />

          {addState && "error" in addState ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {addState.error}
            </p>
          ) : null}
          {addState && "ok" in addState && addState.ok ? (
            <p
              ref={addBannerRef}
              tabIndex={-1}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 outline-none"
            >
              Snippet saved. Matching codes on Build encounters will show this
              text in retrieval citations on the next sync.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="kc-kind"
                className="block text-xs font-medium text-slate-700"
              >
                Kind
              </label>
              <select
                id="kc-kind"
                name="kind"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
                defaultValue="cpt"
              >
                <option value="cpt">CPT / HCPCS</option>
                <option value="icd10">ICD-10-CM</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="kc-lookup"
                className="block text-xs font-medium text-slate-700"
              >
                Code (normalized on save)
              </label>
              <input
                id="kc-lookup"
                name="lookupKey"
                type="text"
                required
                placeholder="e.g. 93015 or I20.9"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="kc-title"
              className="block text-xs font-medium text-slate-700"
            >
              Title
            </label>
            <input
              id="kc-title"
              name="title"
              type="text"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          <div>
            <label
              htmlFor="kc-body"
              className="block text-xs font-medium text-slate-700"
            >
              Body / reference text
            </label>
            <textarea
              id="kc-body"
              name="body"
              rows={5}
              required
              spellCheck={true}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          <div>
            <label
              htmlFor="kc-source"
              className="block text-xs font-medium text-slate-700"
            >
              Source label (optional)
            </label>
            <input
              id="kc-source"
              name="sourceLabel"
              type="text"
              placeholder="e.g. AMA CPT intro, internal SOP v2"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            />
          </div>

          <Button type="submit" disabled={addPending}>
            {addPending ? "Saving…" : "Save snippet"}
          </Button>
          <p className="text-xs text-slate-500">
            Upserts on{" "}
            <code className="rounded bg-slate-100 px-1">tenant + kind + code</code>.
            Not payer policy; use for staff-facing reference only.
          </p>
        </form>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Read-only: tenant admin permissions required to edit retrieval
          snippets.
        </p>
      )}
    </div>
  );
}

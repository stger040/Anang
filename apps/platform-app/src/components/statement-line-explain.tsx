"use client";

import { Badge, Button } from "@anang/ui";
import { useState } from "react";

export function StatementLineExplain({
  orgSlug,
  statementId,
  lineId,
  patientAccessToken,
}: {
  orgSlug: string;
  statementId: string;
  lineId: string;
  /** When set, calls public `/api/pay/patient-explain-line` (no staff session). */
  patientAccessToken?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<"openai" | "template" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onExplain() {
    setLoading(true);
    setError(null);
    try {
      const path = patientAccessToken
        ? "/api/pay/patient-explain-line"
        : "/api/pay/explain-line";
      const body = patientAccessToken
        ? JSON.stringify({ token: patientAccessToken, lineId })
        : JSON.stringify({ orgSlug, statementId, lineId });
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = (await res.json()) as
        | { ok: true; text: string; source: "openai" | "template" }
        | { error?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setError(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Could not generate explanation.",
        );
        setText(null);
        setSource(null);
        return;
      }
      setText(data.text);
      setSource(data.source);
    } catch {
      setError("Network error.");
      setText(null);
      setSource(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={loading}
        onClick={onExplain}
      >
        {loading ? "Explaining…" : "Explain charge"}
      </Button>
      {error ? (
        <p className="mt-2 text-xs text-red-700">{error}</p>
      ) : null}
      {text ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {source === "openai" ? (
              <Badge tone="info">AI-assisted</Badge>
            ) : (
              <Badge tone="default">Template</Badge>
            )}
            <span className="text-[10px] uppercase tracking-wide text-slate-500">
              Education only — not medical or legal advice
            </span>
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
            {text}
          </p>
        </div>
      ) : null}
    </div>
  );
}

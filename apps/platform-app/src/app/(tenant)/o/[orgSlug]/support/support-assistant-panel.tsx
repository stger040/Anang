"use client";

import { Button } from "@anang/ui";
import { useState } from "react";

type TurnResponse = {
  ok?: boolean;
  reply?: string;
  suggestedTools?: string[];
  escalationRecommended?: boolean;
  escalationReason?: string;
  error?: string;
};

export function SupportAssistantPanel({
  orgSlug,
  openTaskCount,
  urgentOpenCount,
}: {
  orgSlug: string;
  openTaskCount: number;
  urgentOpenCount: number;
}) {
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    suggestedTools: string[];
    escalationRecommended: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function send() {
    const msg = input.trim();
    if (!msg || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, message: msg }),
      });
      const data = (await res.json()) as TurnResponse;
      if (!res.ok || data.error) {
        setError(data.error ?? "Request failed");
        return;
      }
      setReply(data.reply ?? "");
      setMeta({
        suggestedTools: data.suggestedTools ?? [],
        escalationRecommended: Boolean(data.escalationRecommended),
      });
      setInput("");
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">
        Support assistant
      </h2>
      <p className="mt-1 text-xs text-slate-600">
        Template mode — no PHI sent to an LLM. Open tasks in this tenant:{" "}
        <span className="font-medium text-slate-800">{openTaskCount}</span>
        {urgentOpenCount > 0 ? (
          <>
            {" "}
            (<span className="font-medium text-red-800">{urgentOpenCount}</span>{" "}
            urgent)
          </>
        ) : null}
        . Separate prompts and tool schema from Claims Build.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="block flex-1 text-xs font-medium text-slate-700">
          Message
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:ring-2 focus:ring-brand-sky"
            placeholder='e.g. "What’s open in the queue?"'
          />
        </label>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || !input.trim()}
          onClick={() => void send()}
        >
          {pending ? "…" : "Send"}
        </Button>
      </div>
      {error ? (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {reply ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
          <p>{reply}</p>
          {meta?.escalationRecommended ? (
            <p className="mt-2 text-xs font-medium text-amber-900">
              Escalation suggested — route to a human per your runbook.
            </p>
          ) : null}
          {meta && meta.suggestedTools.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Suggested tools for a future LLM runner:{" "}
              <code className="rounded bg-slate-100 px-1">
                {meta.suggestedTools.join(", ")}
              </code>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

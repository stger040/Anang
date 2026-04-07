"use client";

import {
  clearDraftLinesForTesting,
  createBlankDraftForEncounterTesting,
  suggestDraftFromEncounterAction,
} from "../../actions";
import { Button } from "@anang/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ActionMessage = { kind: "ok" | "err"; text: string };

export function BuildAiTestingPanel({
  orgSlug,
  encounterId,
  draftId,
}: {
  orgSlug: string;
  encounterId: string;
  draftId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<ActionMessage | null>(null);

  const run = (
    action: "suggest" | "blank" | "clear",
    fn: (fd: FormData) => Promise<unknown>,
    fd: FormData,
  ) => {
    setMsg(null);
    startTransition(async () => {
      try {
        const r = await fn(fd);
        if (r && typeof r === "object" && "ok" in r && r.ok === false) {
          const err =
            "error" in r && typeof r.error === "string"
              ? r.error
              : "Request failed.";
          setMsg({ kind: "err", text: err });
          return;
        }
        let text = "Done.";
        if (action === "suggest" && r && typeof r === "object" && "lineCount" in r) {
          text = `Suggestion applied (${String((r as { lineCount: unknown }).lineCount)} line(s)).`;
        } else if (action === "blank") {
          text = "New blank draft created — it is now the active draft for this encounter.";
        } else if (action === "clear") {
          text = "Draft lines and rule issues cleared.";
        }
        setMsg({ kind: "ok", text });
        router.refresh();
      } catch (e) {
        setMsg({
          kind: "err",
          text: e instanceof Error ? e.message : "Unexpected error.",
        });
      }
    });
  };

  const baseFields = (
    <>
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="encounterId" value={encounterId} />
    </>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Charges on new lines come from the tenant&apos;s deterministic synthetic
        fee table (derived from imported lines), not from the model. Review and
        approve separately.
      </p>
      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "suggest",
              suggestDraftFromEncounterAction,
              new FormData(e.currentTarget),
            );
          }}
        >
          {baseFields}
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Working…" : "Suggest draft from encounter"}
          </Button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              "blank",
              createBlankDraftForEncounterTesting,
              new FormData(e.currentTarget),
            );
          }}
        >
          {baseFields}
          <Button type="submit" size="sm" variant="secondary" disabled={pending}>
            New blank draft
          </Button>
        </form>

        {draftId ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(
                "clear",
                clearDraftLinesForTesting,
                new FormData(e.currentTarget),
              );
            }}
          >
            {baseFields}
            <Button type="submit" size="sm" variant="secondary" disabled={pending}>
              Clear draft lines (testing)
            </Button>
          </form>
        ) : null}
      </div>
      {msg ? (
        <p
          className={`text-sm ${msg.kind === "err" ? "text-red-600" : "text-emerald-800"}`}
          role={msg.kind === "err" ? "alert" : "status"}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}

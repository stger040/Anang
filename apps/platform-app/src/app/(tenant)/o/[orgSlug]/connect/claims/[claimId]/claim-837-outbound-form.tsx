"use client";

import { Button } from "@anang/ui";
import { useActionState, useEffect, useRef } from "react";

import {
  record837OutboundWithTransport,
  type Record837OutboundState,
} from "../../actions";

export function Claim837OutboundForm({
  orgSlug,
  claimId,
  httpTransportConfigured,
}: {
  orgSlug: string;
  claimId: string;
  httpTransportConfigured: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    Record837OutboundState,
    FormData
  >(record837OutboundWithTransport, null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 border-t border-slate-100 pt-4"
    >
      <input type="hidden" name="orgSlug" value={orgSlug} />
      <input type="hidden" name="claimId" value={claimId} />
      <p className="text-xs font-medium text-slate-700">
        Record outbound 837 X12 + optional HTTP pilot
      </p>
      <p className="text-xs text-slate-500">
        Stores a SHA-256 fingerprinted copy via{" "}
        <span className="font-mono">SourceArtifact</span> (connector{" "}
        <span className="font-mono">edi_outbound</span>
        ). Envelope and 837P teaching checks run before save (E2b2b4). If{" "}
        <span className="font-mono">EDI_S3_BUCKET</span> is set, large or
        policy-forced payloads also write{" "}
        <span className="font-mono">SourceArtifact.storageUri</span> (E2b2b5).
        ISA / GS / ST controls correlate 997/999 on the webhook.
      </p>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Clearinghouse / partner
        </label>
        <input
          name="outboundClearinghouseLabel"
          required
          placeholder="Same label you use for manual traces"
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">
          Raw X12 (ISA … ST*837 …)
        </label>
        <textarea
          name="x12Payload"
          required
          rows={6}
          placeholder="ISA*00*…~GS*…~ST*837*…~"
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-[10px] leading-snug shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      </div>
      {httpTransportConfigured ? (
        <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
          <input type="checkbox" name="doHttpTransport" className="mt-0.5" />
          <span>
            POST JSON <span className="font-mono">{"{ x12 }"}</span> to{" "}
            <span className="font-mono">EDI_OUTBOUND_HTTP_URL</span> after the
            artifact is saved (Bearer token optional).
          </span>
        </label>
      ) : (
        <p className="text-[11px] text-slate-500">
          HTTP pilot is off — set{" "}
          <span className="font-mono">EDI_OUTBOUND_HTTP_ENABLED=true</span> and{" "}
          <span className="font-mono">EDI_OUTBOUND_HTTP_URL</span> to enable the
          checkbox above.
        </p>
      )}
      {state && "error" in state ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {state.error}
        </p>
      ) : null}
      {state && "ok" in state && state.ok ? (
        <p
          ref={noticeRef}
          tabIndex={-1}
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 outline-none"
        >
          Saved outbound artifact and submission row.
          {state.httpOk != null ? (
            <>
              {" "}
              HTTP: {state.httpOk ? "ok" : "failed"}
              {state.httpStatus != null ? ` (${state.httpStatus})` : ""}.
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Store X12 + update timeline"}
      </Button>
    </form>
  );
}

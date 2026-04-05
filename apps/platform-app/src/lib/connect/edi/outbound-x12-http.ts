/**
 * Optional HTTP POST of raw X12 to a clearinghouse pilot endpoint (E2b2b3).
 * Gated by env — no-op helpers for UI hints.
 */

export function isEdiOutboundHttpConfigured(): boolean {
  return (
    process.env.EDI_OUTBOUND_HTTP_ENABLED === "true" &&
    Boolean(process.env.EDI_OUTBOUND_HTTP_URL?.trim())
  );
}

export type EdiHttpPostResult = {
  ok: boolean;
  status: number;
  responsePreview: string | null;
  attemptedAt: string;
};

export async function postEdiOutboundX12Http(x12: string): Promise<EdiHttpPostResult> {
  const url = process.env.EDI_OUTBOUND_HTTP_URL?.trim();
  if (!url) {
    throw new Error("EDI_OUTBOUND_HTTP_URL is not set");
  }
  const token = process.env.EDI_OUTBOUND_HTTP_TOKEN?.trim();
  const attemptedAt = new Date().toISOString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ x12 }),
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text().catch(() => "");
  return {
    ok: res.ok,
    status: res.status,
    responsePreview: text ? text.slice(0, 500) : null,
    attemptedAt,
  };
}

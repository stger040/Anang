/**
 * Structured logs for operations and support. Emit **one JSON object per line** (easy to ship to a log drain).
 *
 * **Do not** pass PHI/PII (patient names, DOB, MRNs, free-text clinical content, full card numbers).
 * Prefer tenant/statement/payment **IDs**, org slugs, Stripe IDs, amounts in cents, and event names.
 *
 * **`requestId`:** Incoming `x-request-id` (set by middleware); pass from `req.headers` in Route Handlers.
 */

export type PlatformLogLevel = "debug" | "info" | "warn" | "error";

type FieldValue = string | number | boolean | null | undefined;

function requestIdFromGetter(
  get: (name: string) => string | null,
): string | undefined {
  return (
    get("x-request-id")?.trim() ||
    get("x-correlation-id")?.trim() ||
    undefined
  );
}

/** Prefer `x-request-id` from middleware; accept `x-correlation-id` (common proxies). */
export function readRequestId(req: Request): string | undefined {
  return requestIdFromGetter((name) => req.headers.get(name));
}

/**
 * Server Actions and Server Components: read the same IDs middleware forwards on `/o/*`, `/admin/*`.
 */
export async function readRequestIdFromHeaders(): Promise<string | undefined> {
  const { headers } = await import("next/headers");
  const h = await headers();
  return requestIdFromGetter((name) => h.get(name));
}

function shipPlatformLogToWebhook(payload: Record<string, unknown>): void {
  const url = process.env.PLATFORM_LOG_WEBHOOK_URL?.trim();
  if (!url) return;
  const secret = process.env.PLATFORM_LOG_WEBHOOK_SECRET?.trim();
  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* drain must not break callers */
  });
}

export function platformLog(
  level: PlatformLogLevel,
  event: string,
  fields: Record<string, FieldValue> = {},
): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "anang-platform-app",
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) payload[k] = v;
  }
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
  shipPlatformLogToWebhook(payload);
}

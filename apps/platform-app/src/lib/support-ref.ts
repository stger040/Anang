import { randomUUID } from "node:crypto";

/**
 * Short, human-readable code for patient-facing errors (quote to support).
 * Never includes PHI — derived from `x-request-id` or a fresh UUID.
 */
export function formatSupportRef(requestId: string | undefined): string {
  const raw = (requestId ?? "").trim() || randomUUID();
  const compact = raw.replace(/-/g, "");
  const tail = compact.length >= 8 ? compact.slice(-8).toUpperCase() : compact.toUpperCase();
  return `REF-${tail}`;
}

/**
 * Normalize CPT / HCPCS procedure codes for draft lines and 837P SV1.
 *
 * CPT is typically 5 digits; HCPCS Level II is a letter + 4 digits (e.g. J1100, E0601).
 * Digits-only sanitization silently corrupts alphanumeric HCPCS (J1100 → 1100).
 */
export function normalizeProcedureCode(raw: string): string {
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

/** URL segment for `/o/[orgSlug]/…` — lowercase, hyphenated, no reserved app routes. */

const RESERVED = new Set([
  "admin",
  "api",
  "login",
  "www",
  "static",
  "_next",
]);

export function normalizeTenantSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * @returns canonical slug or `null` if invalid / reserved
 */
export function validateTenantSlug(raw: string): string | null {
  const slug = normalizeTenantSlug(raw);
  if (slug.length < 2 || slug.length > 48) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (RESERVED.has(slug)) return null;
  return slug;
}

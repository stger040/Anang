/** Initials from each whitespace-separated word, uppercased (e.g. "LCO Health Center" → "LHC"). */
export function abbrevOrgDisplayName(name: string): string {
  return name
    .split(/\s+/u)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** First character of slug with leading slash (e.g. "lco" → "/l"). */
export function abbrevOrgSlugForSidebar(slug: string): string {
  const c = slug[0]?.toLowerCase() ?? "";
  return c ? `/${c}` : "/";
}

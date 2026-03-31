/**
 * Cedar-adjacent palette for enterprise healthcare SaaS: deep navy chrome,
 * warm coral CTAs, cream surfaces — inspired by common patterns on cedar.com
 * (not an official Cedar reproduction).
 */
export const cedarInspiredTheme = {
  navy: "#13264C",
  navyDark: "#0B1428",
  navyMid: "#1e3d6e",
  coral: "#E24E42",
  coralHover: "#C63F36",
  cream: "#F7F5F2",
  sky: "#E8F4FC",
  ink: "#0f172a",
  muted: "#64748b",
} as const;

export type CedarInspiredTheme = typeof cedarInspiredTheme;

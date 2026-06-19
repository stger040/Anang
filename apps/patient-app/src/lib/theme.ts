export const colors = {
  navy: "#13264C",
  navyDark: "#0B1428",
  navyMid: "#1e3d6e",
  coral: "#E24E42",
  coralHover: "#C63F36",
  cream: "#F7F5F2",
  sky: "#E8F4FC",
  ink: "#0f172a",
  muted: "#64748b",
  white: "#FFFFFF",
  border: "#e2e8f0",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  surface: "#f8fafc",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const typography = {
  heading1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36 },
  heading2: { fontSize: 22, fontWeight: "700" as const, lineHeight: 30 },
  heading3: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: "400" as const, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: "600" as const, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: "400" as const, lineHeight: 15 },
} as const;

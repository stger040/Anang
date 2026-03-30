/**
 * Central routing assumptions — used by docs and optional runtime checks.
 * Production: marketing = anang.ai, platform = app.anang.ai
 */
export const urls = {
  marketing: "https://anang.ai",
  platform: "https://app.anang.ai",
} as const;

export const appPorts = {
  marketingDev: 3000,
  platformDev: 3001,
} as const;

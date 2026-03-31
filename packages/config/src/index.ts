/**
 * Central routing assumptions — used by docs and optional runtime checks.
 * Production: marketing = anang.ai, platform = app.anang.ai
 */
export const urls = {
  marketing: "https://anang.ai",
  platform: "https://app.anang.ai",
} as const;

const DEFAULT_BOOK_MEETING = "https://calendly.com/nanaandawi/30min";

/**
 * Calendly (or other scheduler) for “Book a demo” / pilot CTAs.
 * Override in Vercel: NEXT_PUBLIC_ANANG_CALENDLY
 */
export function getBookMeetingUrl(): string {
  if (typeof process === "undefined") return DEFAULT_BOOK_MEETING;
  const v = process.env.NEXT_PUBLIC_ANANG_CALENDLY?.trim();
  return v && v.length > 0 ? v : DEFAULT_BOOK_MEETING;
}

export const appPorts = {
  marketingDev: 3000,
  platformDev: 3001,
} as const;

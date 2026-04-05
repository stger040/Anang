import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/** Mirrors session cookie secure flag (AUTH_URL https). */
export function authFlowCookieSecure(): boolean {
  return !!process.env.AUTH_URL?.trim().startsWith("https://");
}

export const INTENDED_ORG_COOKIE = "anang_intended_org";
export const PENDING_INVITE_COOKIE = "anang_pending_invite";

const MAX_AGE_SEC = 60 * 15;

export function authFlowCookieDefaults(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: authFlowCookieSecure(),
    maxAge: MAX_AGE_SEC,
  };
}

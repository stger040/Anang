import {
  APP_SESSION_COOKIE,
  LEGACY_SESSION_COOKIE,
} from "@/lib/session";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Clears legacy staging cookies and Auth.js session cookies (v5 names).
 * Prefer `signOut()` from `next-auth/react` in the UI; this supports API clients.
 */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  platformLog("info", "auth.logout.cookies_cleared", {
    ...(requestId ? { requestId } : {}),
  });
  const jar = await cookies();
  jar.delete(APP_SESSION_COOKIE);
  jar.delete(LEGACY_SESSION_COOKIE);
  jar.delete("authjs.session-token");
  jar.delete("__Secure-authjs.session-token");
  jar.delete("__Host-authjs.csrf-token");
  jar.delete("authjs.csrf-token");
  jar.delete("__Secure-authjs.pkce.code_verifier");
  return NextResponse.json({ ok: true });
}

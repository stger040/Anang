import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

function injectRequestId(req: NextRequest): { requestId: string; requestHeaders: Headers } {
  const requestId =
    req.headers.get("x-request-id")?.trim() ||
    req.headers.get("x-correlation-id")?.trim() ||
    crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);
  return { requestId, requestHeaders };
}

function continueWithRequestId(req: NextRequest): NextResponse {
  const { requestId, requestHeaders } = injectRequestId(req);
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("x-request-id", requestId);
  return res;
}

/**
 * Edge-safe: `auth.config` only for JWT. Injects `x-request-id` on `/api`, `/invite`, `/post-signin`,
 * and tenant/admin routes. `/invite` and `/login` are public (no session). API routes enforce
 * their own auth; `/admin` and `/o` require a session here.
 */
export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    return continueWithRequestId(req);
  }

  /** Public invite links — correlate audits without forcing sign-in first. */
  if (pathname.startsWith("/invite/")) {
    return continueWithRequestId(req);
  }

  /** Sign-in page — RSC / future actions can correlate via `readRequestIdFromHeaders`. */
  if (pathname === "/login") {
    return continueWithRequestId(req);
  }

  /** Public patient billing — magic-link pages still get `x-request-id` for support correlation. */
  if (pathname.startsWith("/p/")) {
    return continueWithRequestId(req);
  }

  const { requestId, requestHeaders } = injectRequestId(req);

  if (!req.auth?.user) {
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(login);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  res.headers.set("x-request-id", requestId);
  return res;
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/o/:path*",
    "/api/:path*",
    "/invite/:path*",
    "/login",
    "/post-signin",
    "/p/:path*",
  ],
};

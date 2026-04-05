import { encode } from "next-auth/jwt";
import type { AppRole } from "@prisma/client";
import type { NextResponse } from "next/server";

export function authUsesSecureCookies(): boolean {
  const u = process.env.AUTH_URL?.trim();
  return !!u?.startsWith("https://");
}

export function sessionTokenCookieName(): string {
  return authUsesSecureCookies()
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

export async function encodeAuthJsSessionValue(payload: {
  userId: string;
  email: string;
  appRole: AppRole;
}): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  const salt = sessionTokenCookieName();
  return encode({
    secret,
    salt,
    maxAge: SESSION_MAX_AGE_SEC,
    token: {
      sub: payload.userId,
      email: payload.email,
      appRole: payload.appRole,
    },
  });
}

export function applySessionCookieToResponse(
  res: NextResponse,
  jwt: string,
): void {
  const secure = authUsesSecureCookies();
  res.cookies.set(sessionTokenCookieName(), jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

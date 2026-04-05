import type { AppRole } from "@prisma/client";

import { auth } from "@/auth";

/** @deprecated Legacy cookie names — cleared in `/api/auth/logout` for upgrades */
export const APP_SESSION_COOKIE = "anang_session";
export const LEGACY_SESSION_COOKIE = "anang_demo_session";
export const SESSION_COOKIES = [APP_SESSION_COOKIE, LEGACY_SESSION_COOKIE] as const;

export type SessionPayload = {
  userId: string;
  email: string;
  appRole: AppRole;
};

/** @deprecated Use SessionPayload */
export type DemoSessionPayload = SessionPayload;

/** Server-only session from Auth.js (OIDC or staging credentials). */
export async function getSession(): Promise<SessionPayload | null> {
  const s = await auth();
  if (!s?.user?.id || !s.user.email) return null;
  return {
    userId: s.user.id,
    email: s.user.email,
    appRole: s.user.appRole,
  };
}

/** @deprecated Use getSession */
export async function getDemoSession(): Promise<SessionPayload | null> {
  return getSession();
}

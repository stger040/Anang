import { prisma } from "@/lib/prisma";
import type { AppRole } from "@prisma/client";

export type AuthSessionUser = {
  id: string;
  email: string;
  appRole: AppRole;
};

/**
 * Load the live platform role for an Auth.js session/JWT.
 * `appRole` must not be trusted from a long-lived JWT alone — revocation
 * (SUPER_ADMIN → STAFF) has to take effect on the next session read.
 */
export async function loadAuthSessionUser(
  userId: string,
): Promise<AuthSessionUser | null> {
  const id = userId.trim();
  if (!id) return null;
  const u = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, appRole: true },
  });
  if (!u) return null;
  return { id: u.id, email: u.email, appRole: u.appRole };
}

/** Apply a fresh DB user onto a JWT-shaped token, or signal invalidation. */
export function applyAuthSessionUserToToken<
  T extends { sub?: string | null; email?: string | null; appRole?: AppRole },
>(token: T, user: AuthSessionUser | null): T | null {
  if (!user) return null;
  return {
    ...token,
    sub: user.id,
    email: user.email,
    appRole: user.appRole,
  };
}

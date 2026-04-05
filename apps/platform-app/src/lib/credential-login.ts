import { prisma } from "@/lib/prisma";
import { getPlatformLoginPassword, getVirtualLoginEmail } from "@/lib/auth-config";
import {
  PROFILE_TO_USER_EMAIL,
  type AccessProfileId,
} from "@/lib/login-routing";
import type { AppRole } from "@prisma/client";

function isValidProfile(x: unknown): x is AccessProfileId {
  return typeof x === "string" && x in PROFILE_TO_USER_EMAIL;
}

export type CredentialLoginResult = {
  id: string;
  email: string;
  appRole: AppRole;
};

/**
 * Staging password flow (shared secret). Returns Prisma user row fields or null.
 */
export async function resolveCredentialLogin(input: {
  email: string;
  password: string;
  accessProfile?: string;
}): Promise<CredentialLoginResult | null> {
  const emailRaw = input.email.trim().toLowerCase();
  const password = input.password;
  if (!emailRaw || !password) return null;

  const virtualEmail = getVirtualLoginEmail();
  const platformPw = getPlatformLoginPassword();

  let targetEmail: string;

  if (emailRaw === virtualEmail) {
    if (password !== platformPw) return null;
    if (!isValidProfile(input.accessProfile)) return null;
    targetEmail = PROFILE_TO_USER_EMAIL[input.accessProfile];
  } else {
    if (password !== platformPw) return null;
    targetEmail = emailRaw;
  }

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    appRole: user.appRole,
  };
}

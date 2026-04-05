import { prisma, tenantPrisma } from "@/lib/prisma";
import { getPlatformLoginPassword, getVirtualLoginEmail } from "@/lib/auth-config";
import {
  PROFILE_TO_USER_EMAIL,
  type AccessProfileId,
} from "@/lib/login-routing";
import { validateTenantSlug } from "@/lib/platform-slug";
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
  /** When set (e.g. `?org=`), user row is resolved from that tenant’s DB (`DATABASE_URL__…` when configured). */
  tenantSlug?: string;
}): Promise<CredentialLoginResult | null> {
  const emailRaw = input.email.trim().toLowerCase();
  const password = input.password;
  if (!emailRaw || !password) return null;

  const virtualEmail = getVirtualLoginEmail();
  const platformPw = getPlatformLoginPassword();

  let targetEmail: string;

  if (emailRaw === virtualEmail) {
    if (password !== platformPw) return null;
    const profile =
      input.accessProfile && isValidProfile(input.accessProfile)
        ? input.accessProfile
        : "enterprise";
    targetEmail = PROFILE_TO_USER_EMAIL[profile];
  } else {
    if (password !== platformPw) return null;
    targetEmail = emailRaw;
  }

  const org = validateTenantSlug(input.tenantSlug?.trim() ?? "");
  const db =
    emailRaw === virtualEmail || !org ? prisma : tenantPrisma(org);

  const user = await db.user.findUnique({ where: { email: targetEmail } });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    appRole: user.appRole,
  };
}

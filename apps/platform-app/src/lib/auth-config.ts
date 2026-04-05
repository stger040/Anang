/**
 * Staging / pilot password until enterprise SSO (SAML/OIDC) replaces this flow.
 * Set strong secrets in production; never commit real passwords.
 */
export function getPlatformLoginPassword(): string {
  const fromPlatform = process.env.PLATFORM_LOGIN_PASSWORD?.trim();
  if (fromPlatform) return fromPlatform;
  const legacy = process.env.DEMO_LOGIN_PASSWORD?.trim();
  if (legacy) return legacy;
  return "demo";
}

/**
 * Virtual mailbox email: same password for all pilot profiles; tier/profile
 * picker decides which seeded user row loads (until IdP issues real identities).
 */
export function getVirtualLoginEmail(): string {
  const p = process.env.PLATFORM_VIRTUAL_EMAIL?.trim().toLowerCase();
  if (p) return p;
  const legacy = process.env.DEMO_LOGIN_EMAIL?.trim().toLowerCase();
  if (legacy) return legacy;
  return "support@anang.ai";
}

/**
 * When `ANANG_UNLOCK_ALL_MODULES` is `1` / `true` / `yes`, every tenant workspace
 * exposes all modules and ignores staff allow-lists — local / synthetic DB testing only.
 * Never enable in production.
 */
export function unlockAllModulesForTesting(): boolean {
  const v = process.env.ANANG_UNLOCK_ALL_MODULES?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

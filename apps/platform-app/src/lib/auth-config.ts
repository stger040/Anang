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
  return "access@anang.ai";
}

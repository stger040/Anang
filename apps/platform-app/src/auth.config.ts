import type { NextAuthConfig } from "next-auth";

function oidcProviders(): NextAuthConfig["providers"] {
  const issuer = process.env.AUTH_OIDC_ISSUER?.trim();
  if (!issuer) return [];
  const clientId = process.env.AUTH_OIDC_ID?.trim();
  const clientSecret = process.env.AUTH_OIDC_SECRET?.trim();
  if (!clientId || !clientSecret) return [];

  return [
    {
      id: "oidc",
      name: process.env.AUTH_OIDC_NAME?.trim() || "Enterprise SSO",
      type: "oidc" as const,
      issuer,
      clientId,
      clientSecret,
      authorization: {
        params: { scope: "openid email profile" },
      },
    },
  ];
}

/**
 * Edge-safe slice (no Prisma, no Credentials `authorize`). OIDC entries only when env is set.
 * Middleware + JWT verification use this. Full app merges Credentials in `auth.ts`.
 */
export default {
  trustHost: true,
  providers: [...oidcProviders()],
  pages: { signIn: "/login" },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7,
  },
} satisfies NextAuthConfig;

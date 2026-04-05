import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AppRole } from "@prisma/client";

import authConfig from "./auth.config";
import { resolveCredentialLogin } from "@/lib/credential-login";
import { platformLog } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { passwordAllowedForTenantSlug } from "@/lib/tenant-auth-settings";

import type { JWT } from "next-auth/jwt";

async function attachDbUserToToken(
  token: JWT,
  emailLower: string | undefined,
): Promise<JWT> {
  if (!emailLower) return token;
  const u = await prisma.user.findUnique({
    where: { email: emailLower },
  });
  if (!u) return token;
  token.sub = u.id;
  token.appRole = u.appRole;
  token.email = u.email;
  return token;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        accessProfile: { label: "accessProfile", type: "text" },
        tenantSlug: { label: "tenantSlug", type: "text" },
      },
      authorize: async (c) => {
        if (!c?.email || typeof c.password !== "string") return null;
        const user = await resolveCredentialLogin({
          email: String(c.email),
          password: c.password,
          accessProfile:
            typeof c.accessProfile === "string" ? c.accessProfile : undefined,
          tenantSlug:
            typeof c.tenantSlug === "string" ? c.tenantSlug : undefined,
        });
        if (!user) return null;
        if (user.appRole !== AppRole.SUPER_ADMIN) {
          const slug =
            typeof c.tenantSlug === "string" ? c.tenantSlug.trim() : "";
          if (slug) {
            const pwdOk = await passwordAllowedForTenantSlug(slug);
            if (!pwdOk) return null;
          }
        }
        return {
          id: user.id,
          email: user.email,
          appRole: user.appRole,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "oidc") return true;
      const email = (profile as { email?: string } | undefined)?.email?.toLowerCase();
      if (!email) return false;
      const u = await prisma.user.findUnique({ where: { email } });
      if (!u) return "/login?error=sso_unknown_user";
      return true;
    },
    async jwt({ token, user, account, profile }): Promise<JWT> {
      if (account?.provider === "credentials" && user) {
        token.sub = user.id;
        token.appRole = (user as { appRole: AppRole }).appRole;
        token.email = user.email ?? undefined;
        return token;
      }
      if (account?.provider === "oidc" && profile) {
        const email = (profile as { email?: string }).email?.toLowerCase();
        return attachDbUserToToken(token, email);
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && token.email) {
        session.user.id = token.sub;
        session.user.email = token.email as string;
        session.user.appRole = token.appRole as AppRole;
      }
      return session;
    },
  },
  /**
   * Fires for **`/api/auth/*`** (credentials + **global** OIDC from `auth.config`). Tenant OIDC uses
   * `/api/auth/tenant-oidc/...` — see **`auth.tenant_oidc.*`** logs there. No email in log lines.
   */
  events: {
    signIn({ user, account, isNewUser }) {
      const provider = account?.provider ?? "unknown";
      platformLog("info", "auth.nextauth.sign_in", {
        provider,
        ...(user?.id ? { userId: user.id } : {}),
        ...(typeof isNewUser === "boolean" ? { isNewUser } : {}),
      });
    },
    signOut(message) {
      const token =
        "token" in message ? (message.token as JWT | null | undefined) : null;
      const userId = token?.sub;
      platformLog("info", "auth.nextauth.sign_out", {
        ...(typeof userId === "string" && userId ? { userId } : {}),
      });
    },
  },
});

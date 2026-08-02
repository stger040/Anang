import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { AppRole } from "@prisma/client";

import authConfig from "./auth.config";
import { resolveCredentialLogin } from "@/lib/credential-login";
import {
  applyAuthSessionUserToToken,
  loadAuthSessionUser,
} from "@/lib/auth-session-user";
import { platformLog } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { passwordAllowedForTenantSlug } from "@/lib/tenant-auth-queries";

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

/** Re-read appRole from Postgres so JWT maxAge cannot outlive a privilege revoke. */
async function refreshTokenAppRoleFromDb(token: JWT): Promise<JWT | null> {
  if (!token.sub) return token;
  const user = await loadAuthSessionUser(token.sub);
  return applyAuthSessionUserToToken(token, user);
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
    async jwt({ token, user, account, profile }): Promise<JWT | null> {
      if (account?.provider === "credentials" && user) {
        token.sub = user.id;
        token.appRole = (user as { appRole: AppRole }).appRole;
        token.email = user.email ?? undefined;
        // Still refresh below so a concurrent DB demotion cannot stick in the cookie.
      } else if (account?.provider === "oidc" && profile) {
        const email = (profile as { email?: string }).email?.toLowerCase();
        token = await attachDbUserToToken(token, email);
      }

      const refreshed = await refreshTokenAppRoleFromDb(token);
      // `null` clears the session cookie (see @auth/core session action).
      if (!refreshed) return null;
      return refreshed;
    },
    async session({ session, token }) {
      const cleared = {
        ...session,
        user: {
          ...session.user,
          id: undefined as unknown as string,
          email: undefined as unknown as string,
          appRole: undefined as unknown as AppRole,
        },
      };
      if (!token.sub) {
        return cleared;
      }
      // Never trust cookie-stamped appRole alone — membership is already DB-backed
      // in assertOrgAccess; platform SUPER_ADMIN must be equally fresh.
      const user = await loadAuthSessionUser(token.sub);
      if (!user) {
        return cleared;
      }
      session.user.id = user.id;
      session.user.email = user.email;
      session.user.appRole = user.appRole;
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

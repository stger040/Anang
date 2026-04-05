import * as oauth from "oauth4webapi";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  applySessionCookieToResponse,
  encodeAuthJsSessionValue,
} from "@/lib/auth-cookie-session";
import { getAppOrigin } from "@/lib/app-origin";
import { postSignInPath } from "@/lib/post-signin-url";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import {
  loadTenantAuthRow,
  parseTenantAuthSettings,
  tenantJitMembershipAppRole,
  tenantOidcSecretFromEnv,
} from "@/lib/tenant-auth-settings";
import { AppRole } from "@prisma/client";

export const dynamic = "force-dynamic";

const PKCE_COOKIE = "anang.oidc.pkce";

type PkceCookie = {
  slug: string;
  state: string;
  code_verifier: string;
  nonce: string | null;
  pendingInviteToken: string | null;
};

function emailFromClaims(claims: oauth.JsonObject & { email?: unknown; preferred_username?: unknown }): string | undefined {
  const e = claims.email;
  if (typeof e === "string" && e.includes("@")) return e.toLowerCase();
  const pref = claims.preferred_username;
  if (typeof pref === "string" && pref.includes("@"))
    return pref.toLowerCase();
  return undefined;
}

function displayNameFromClaims(
  claims: oauth.JsonObject & {
    name?: unknown;
    given_name?: unknown;
    family_name?: unknown;
  },
): string | undefined {
  const n = claims.name;
  if (typeof n === "string" && n.trim()) return n.trim();
  const g = claims.given_name;
  const f = claims.family_name;
  if (typeof g === "string" && typeof f === "string" && (g.trim() || f.trim()))
    return `${g.trim()} ${f.trim()}`.trim();
  if (typeof g === "string" && g.trim()) return g.trim();
  if (typeof f === "string" && f.trim()) return f.trim();
  return undefined;
}

function oidcCallbackFail(
  base: string,
  location: string,
  requestId: string | undefined,
  reason: string,
  extra: Record<string, string | boolean | undefined> = {},
) {
  platformLog("warn", "auth.tenant_oidc.callback_failed", {
    ...(requestId ? { requestId } : {}),
    reason,
    ...extra,
  });
  return NextResponse.redirect(new URL(location, base));
}

export async function GET(
  req: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const base = getAppOrigin();
  const requestId = readRequestId(req);
  let jitCreatedUser = false;
  let jitCreatedMembership = false;
  const { orgSlug: raw } = await context.params;
  const slug = validateTenantSlug(raw);
  if (!slug) {
    return oidcCallbackFail(base, "/login?error=oidc_invalid_org", requestId, "invalid_slug");
  }

  const cookieJar = await cookies();
  const rawCookie = cookieJar.get(PKCE_COOKIE)?.value;
  let stored: PkceCookie | null = null;
  if (rawCookie) {
    try {
      stored = JSON.parse(rawCookie) as PkceCookie;
    } catch {
      stored = null;
    }
  }
  if (!stored || stored.slug !== slug) {
    return oidcCallbackFail(base, "/login?error=oidc_state", requestId, "pkce_state", {
      tenantSlug: slug,
    });
  }

  const pendingInvite =
    typeof stored.pendingInviteToken === "string"
      ? stored.pendingInviteToken
      : null;

  const row = await loadTenantAuthRow(slug);
  if (!row) {
    return oidcCallbackFail(base, "/login?error=oidc_invalid_org", requestId, "tenant_not_found", {
      tenantSlug: slug,
    });
  }

  const auth = parseTenantAuthSettings(
    (row.settings as Record<string, unknown>)?.auth,
  );
  const secret = tenantOidcSecretFromEnv(slug);
  if (!auth.oidc?.issuer || !auth.oidc.clientId || !secret) {
    return oidcCallbackFail(
      base,
      `/login?org=${slug}&error=oidc_not_configured`,
      requestId,
      "oidc_not_configured",
      { tenantSlug: slug },
    );
  }

  let as: oauth.AuthorizationServer;
  try {
    const issuerUrl = new URL(auth.oidc.issuer);
    const insecure = issuerUrl.protocol === "http:";
    const discovery = await oauth.discoveryRequest(issuerUrl, {
      ...(insecure ? { [oauth.allowInsecureRequests]: true } : {}),
    });
    as = await oauth.processDiscoveryResponse(issuerUrl, discovery);
  } catch {
    return oidcCallbackFail(
      base,
      `/login?org=${slug}&error=oidc_token`,
      requestId,
      "discovery_failed",
      { tenantSlug: slug },
    );
  }

  const client: oauth.Client = { client_id: auth.oidc.clientId };
  const clientAuth = oauth.ClientSecretPost(secret);
  const redirect_uri = `${base}/api/auth/tenant-oidc/${slug}/callback`;

  let params: URLSearchParams;
  try {
    params = oauth.validateAuthResponse(
      as,
      client,
      new URL(req.url),
      stored.state,
    );
  } catch {
    return oidcCallbackFail(base, "/login?error=oidc_denied", requestId, "auth_response_invalid", {
      tenantSlug: slug,
    });
  }

  let response: Response;
  try {
    response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      params,
      redirect_uri,
      stored.code_verifier,
    );
  } catch {
    return oidcCallbackFail(base, "/login?error=oidc_token", requestId, "token_endpoint_request", {
      tenantSlug: slug,
    });
  }

  let result: oauth.TokenEndpointResponse;
  try {
    result = await oauth.processAuthorizationCodeResponse(as, client, response, {
      expectedNonce: stored.nonce ?? oauth.expectNoNonce,
      requireIdToken: true,
    });
  } catch {
    return oidcCallbackFail(base, "/login?error=oidc_token", requestId, "id_token_processing", {
      tenantSlug: slug,
    });
  }

  const claims = oauth.getValidatedIdTokenClaims(result) as
    | (oauth.JsonObject & {
        email?: unknown;
        preferred_username?: unknown;
        name?: unknown;
        given_name?: unknown;
        family_name?: unknown;
      })
    | undefined;
  const email = claims ? emailFromClaims(claims) : undefined;
  if (!email) {
    return oidcCallbackFail(base, "/login?error=oidc_no_email", requestId, "id_token_no_email", {
      tenantSlug: slug,
    });
  }

  const displayName = claims ? displayNameFromClaims(claims) : undefined;

  const db = tenantPrisma(slug);
  let user = await db.user.findUnique({ where: { email } });
  const existingMembership = user
    ? await db.membership.findUnique({
        where: {
          userId_tenantId: { userId: user.id, tenantId: row.id },
        },
      })
    : null;

  if (!user) {
    if (!auth.jitProvisioning) {
      return oidcCallbackFail(base, "/login?error=sso_unknown_user", requestId, "unknown_user_no_jit", {
        tenantSlug: slug,
      });
    }
    const name = displayName ?? email.split("@")[0] ?? "User";
    const memRole = tenantJitMembershipAppRole(auth);
    user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          name,
          appRole: AppRole.STAFF,
        },
      });
      await tx.membership.create({
        data: {
          userId: u.id,
          tenantId: row.id,
          role: memRole,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: row.id,
          actorUserId: null,
          action: "auth.oidc.jit_user_created",
          resource: "user",
          metadata: {
            email,
            tenantSlug: slug,
            ...(requestId ? { requestId } : {}),
          },
        },
      });
      return u;
    });
    jitCreatedUser = true;
  } else if (!existingMembership) {
    if (!auth.jitProvisioning) {
      return oidcCallbackFail(
        base,
        `/login?org=${encodeURIComponent(slug)}&error=sso_no_tenant_membership`,
        requestId,
        "no_membership_no_jit",
        { tenantSlug: slug },
      );
    }
    const tenantUser = user;
    if (!tenantUser) {
      return oidcCallbackFail(base, "/login?error=session", requestId, "user_missing", {
        tenantSlug: slug,
      });
    }
    const memRole = tenantJitMembershipAppRole(auth);
    await db.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          userId: tenantUser.id,
          tenantId: row.id,
          role: memRole,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: row.id,
          actorUserId: null,
          action: "auth.oidc.jit_membership_created",
          resource: "membership",
          metadata: {
            email,
            userId: tenantUser.id,
            tenantSlug: slug,
            ...(requestId ? { requestId } : {}),
          },
        },
      });
    });
    jitCreatedMembership = true;
  }

  if (!user) {
    return oidcCallbackFail(base, "/login?error=session", requestId, "session_user_missing", {
      tenantSlug: slug,
    });
  }

  try {
    const jwt = await encodeAuthJsSessionValue({
      userId: user.id,
      email: user.email,
      appRole: user.appRole,
    });
    platformLog("info", "auth.tenant_oidc.session_issued", {
      ...(requestId ? { requestId } : {}),
      tenantId: row.id,
      tenantSlug: slug,
      jitCreatedUser,
      jitCreatedMembership,
      pendingInvite: !!pendingInvite,
    });
    const res = NextResponse.redirect(
      new URL(
        postSignInPath({
          intendedOrgSlug: slug,
          pendingInviteToken: pendingInvite ?? undefined,
        }),
        base,
      ),
    );
    res.cookies.delete(PKCE_COOKIE);
    applySessionCookieToResponse(res, jwt);
    return res;
  } catch {
    return oidcCallbackFail(base, "/login?error=session", requestId, "session_encode_failed", {
      tenantSlug: slug,
      tenantId: row.id,
    });
  }
}

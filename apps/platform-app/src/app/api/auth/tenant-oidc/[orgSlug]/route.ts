import * as oauth from "oauth4webapi";
import { NextResponse } from "next/server";

import { getAppOrigin } from "@/lib/app-origin";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { validateTenantSlug } from "@/lib/platform-slug";
import { parseTenantAuthSettings, tenantOidcSecretFromEnv } from "@/lib/tenant-auth-settings";
import { loadTenantAuthRow } from "@/lib/tenant-auth-queries";

export const dynamic = "force-dynamic";

const PKCE_COOKIE = "anang.oidc.pkce";

type PkceCookie = {
  slug: string;
  state: string;
  code_verifier: string;
  nonce: string | null;
  pendingInviteToken: string | null;
};

function abortTenantOidcStart(
  req: Request,
  target: URL,
  reason: string,
  tenantSlug?: string,
) {
  const requestId = readRequestId(req);
  platformLog("warn", "auth.tenant_oidc.start_aborted", {
    ...(requestId ? { requestId } : {}),
    reason,
    ...(tenantSlug ? { tenantSlug } : {}),
  });
  return NextResponse.redirect(target);
}

export async function GET(
  req: Request,
  context: { params: Promise<{ orgSlug: string }> },
) {
  const startUrl = new URL(req.url);
  const inviteRaw = startUrl.searchParams.get("invite")?.trim();
  const pendingInviteToken =
    inviteRaw && inviteRaw.length >= 16 && inviteRaw.length <= 512
      ? inviteRaw
      : null;

  const { orgSlug: raw } = await context.params;
  const slug = validateTenantSlug(raw);
  if (!slug) {
    return abortTenantOidcStart(
      req,
      new URL("/login?error=oidc_invalid_org", getAppOrigin()),
      "invalid_slug",
    );
  }

  const row = await loadTenantAuthRow(slug);
  if (!row) {
    return abortTenantOidcStart(
      req,
      new URL("/login?error=oidc_invalid_org", getAppOrigin()),
      "tenant_not_found",
      slug,
    );
  }

  const auth = parseTenantAuthSettings(
    (row.settings as Record<string, unknown>)?.auth,
  );
  if (auth.policy === "local_only") {
    return abortTenantOidcStart(
      req,
      new URL(`/login?org=${slug}&error=sso_not_enabled`, getAppOrigin()),
      "policy_local_only",
      slug,
    );
  }
  if (!auth.oidc?.issuer || !auth.oidc.clientId) {
    return abortTenantOidcStart(
      req,
      new URL(`/login?org=${slug}&error=oidc_not_configured`, getAppOrigin()),
      "oidc_not_configured",
      slug,
    );
  }
  const secret = tenantOidcSecretFromEnv(slug);
  if (!secret) {
    return abortTenantOidcStart(
      req,
      new URL(`/login?org=${slug}&error=oidc_missing_secret`, getAppOrigin()),
      "missing_client_secret",
      slug,
    );
  }

  let issuerUrl: URL;
  try {
    issuerUrl = new URL(auth.oidc.issuer);
  } catch {
    return abortTenantOidcStart(
      req,
      new URL(`/login?org=${slug}&error=oidc_bad_issuer`, getAppOrigin()),
      "bad_issuer_url",
      slug,
    );
  }

  const insecure = issuerUrl.protocol === "http:";
  let as: oauth.AuthorizationServer;
  try {
    const discovery = await oauth.discoveryRequest(issuerUrl, {
      ...(insecure ? { [oauth.allowInsecureRequests]: true } : {}),
    });
    as = await oauth.processDiscoveryResponse(issuerUrl, discovery);
  } catch {
    return abortTenantOidcStart(
      req,
      new URL(`/login?org=${slug}&error=oidc_token`, getAppOrigin()),
      "discovery_failed",
      slug,
    );
  }

  const client: oauth.Client = { client_id: auth.oidc.clientId };

  const code_verifier = oauth.generateRandomCodeVerifier();
  const code_challenge = await oauth.calculatePKCECodeChallenge(code_verifier);
  const state = oauth.generateRandomState();
  let nonce: string | undefined;
  if (as.code_challenge_methods_supported?.includes("S256") !== true) {
    nonce = oauth.generateRandomNonce();
  }

  const redirect_uri = `${getAppOrigin()}/api/auth/tenant-oidc/${slug}/callback`;

  const authorizationUrl = new URL(as.authorization_endpoint!);
  authorizationUrl.searchParams.set("client_id", client.client_id);
  authorizationUrl.searchParams.set("redirect_uri", redirect_uri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("code_challenge", code_challenge);
  authorizationUrl.searchParams.set("code_challenge_method", "S256");
  if (nonce) {
    authorizationUrl.searchParams.set("nonce", nonce);
  }

  const payload: PkceCookie = {
    slug,
    state,
    code_verifier,
    nonce: nonce ?? null,
    pendingInviteToken,
  };

  const requestId = readRequestId(req);
  platformLog("info", "auth.tenant_oidc.redirect_issued", {
    ...(requestId ? { requestId } : {}),
    tenantSlug: slug,
    pendingInvite: !!pendingInviteToken,
  });

  const res = NextResponse.redirect(authorizationUrl.href);
  res.cookies.set(PKCE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: getAppOrigin().startsWith("https://"),
    maxAge: 600,
  });
  return res;
}

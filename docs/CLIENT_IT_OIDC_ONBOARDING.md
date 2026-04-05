# Client IT — OpenID Connect (OIDC) SSO for Anang

This document is for **customer identity / security teams** integrating their IdP (e.g. Microsoft Entra ID, Okta, Ping) with the Anang platform app. The product uses **Auth.js** with **OIDC**. SSO is **optional per tenant** until your organization sets policy to **SSO required**.

---

## 1. Information your IdP team must provide or register

### 1.1 Values Anang stores in tenant configuration (non-secret)

| Item | Description |
|------|-------------|
| **Issuer URL** | OIDC issuer from your provider’s discovery document (often ends with `/v2.0` for Entra). Example shape: `https://login.microsoftonline.com/{directory-tenant-id}/v2.0`. |
| **Client ID** | Application (client) ID of the OIDC “confidential” or “web” app registration created for Anang. |

Your Anang operator enters these in **`/admin`** → tenant → **Authentication & SSO**.

### 1.2 Client secret (never in the database)

The **client secret** is stored only in the **deployment environment** (e.g. Vercel env vars), not in `Tenant.settings`.

Per tenant, set:

```text
AUTH_OIDC_CLIENT_SECRET__{TENANT_SLUG_UPPERCASE}
```

Example: tenant slug `hayward` → env var `AUTH_OIDC_CLIENT_SECRET__HAYWARD`.

Rules for the suffix: the slug is uppercased; characters other than `A–Z` and `0–9` become underscores (see implementation: `clientSecretEnvKeyForTenantSlug` in the platform app). The exact name is shown in the admin form for each tenant.

### 1.3 Redirect URI(s) to register in your IdP

You must register **exact** redirect URIs Anang will send in the authorization response (no wildcards unless your IdP documents support for your app type).

**Dedicated OIDC app per tenant (recommended for production)**

Register this callback URL (replace origin and slug):

```text
{APP_ORIGIN}/api/auth/tenant-oidc/{tenantSlug}/callback
```

Example: `https://app.anang.ai/api/auth/tenant-oidc/hayward/callback`.

`APP_ORIGIN` is the canonical public base URL (`AUTH_URL` in production, typically with **no** trailing slash). Your operator can copy the **exact** redirect URI from the same admin screen.

**Platform-wide OIDC (shared app registration)**

Used when all three are set: `AUTH_OIDC_ISSUER`, `AUTH_OIDC_ID`, `AUTH_OIDC_SECRET`. Register:

```text
{APP_ORIGIN}/api/auth/callback/oidc
```

This path is the **global** Auth.js OIDC callback, not tenant-specific. It is optional and does **not** replace per-tenant registration when each customer has their own app in Entra.

### 1.4 Typical IdP settings

- **Protocol:** OpenID Connect (authorization code).
- **PKCE:** Supported by the tenant OIDC routes (recommended by providers).
- **Token types:** ID token must include a stable **email** claim (see §3).

---

## 2. Per-tenant auth policies (what users experience)

Configured under **`/admin`** → tenant → **Authentication & SSO**:

| Policy | Password login (`?org=` link) | SSO |
|--------|---------------------------------|-----|
| **local_only** | Allowed | Hidden for that org context |
| **sso_allowed** | Allowed | **Organization SSO** and/or **platform OIDC** (if configured) shown |
| **sso_required** | **Blocked** when signing in with `?org=` | Must use an available SSO path |

**Super admins** can still use internal flows without an org-scoped link where the product allows it; customer staff should use the link their IT shares (`/login?org={slug}`).

---

## 3. How users are matched (email-based)

After a successful OIDC login, Anang resolves the user by **normalized email** against the **`User`** table (ID token `email`, or `preferred_username` when it looks like an email).

**Per-tenant OIDC (`/api/auth/tenant-oidc/...`):**

- By default, the user must **already** exist and have a **`Membership`** for that tenant (or you get a clear error).
- Optionally, **JIT provisioning** can be turned on in **`/admin`** → tenant → **Authentication & SSO**: first sign-in may **create** a `User` (platform `appRole` is always `STAFF`) and/or **add** a `Membership` for this org with role **STAFF** or **TENANT_ADMIN** (configurable). Audit actions: `auth.oidc.jit_user_created`, `auth.oidc.jit_membership_created`.
- Use JIT only when your security team accepts IdP-trusted email → workspace access without a prior admin click.

**Platform-wide OIDC (`AUTH_OIDC_*`, Auth.js default callback):** still requires a **pre-existing** `User.row` — no JIT in this path. Prefer per-tenant OIDC when customers bring their own app registration.

**Super admins** use operator flows; `User.appRole === SUPER_ADMIN` is never granted by JIT.

---

## 4. Onboarding checklist — client IT

Use this as a paste-friendly checklist with your Anang project lead.

- [ ] Confirm **environment URL** (`APP_ORIGIN` / `AUTH_URL`) for staging and production.
- [ ] Create an **OIDC web application** in your IdP for Anang (per-tenant app recommended).
- [ ] Register the **redirect URI** from §1.3 (copy from admin UI after slug is known).
- [ ] Provide **issuer URL** and **client ID** securely to the Anang operator (ticket or call; not in email if your policy forbids).
- [ ] Create or rotate **client secret**; send to Anang ops via your **approved secret channel** so they set `AUTH_OIDC_CLIENT_SECRET__…` (never commit to git).
- [ ] Confirm ID tokens emit **email** (or a `preferred_username` that is the corporate email).
- [ ] Confirm test users exist as **`User` + `Membership`** in Anang before UAT — or confirm **JIT provisioning** is enabled for pilot only with your security sign-off.
- [ ] Pilot: set policy **sso_allowed**; after validation, switch to **sso_required** if password must be disabled for that org.
- [ ] Document **support path** for locked-out users (wrong email claim, missing membership).

---

## 5. Related documentation

- Operator deploy and env vars: **`docs/DEPLOYMENT.md`**
- Tenancy, virtual mailbox, seed users: **`docs/TENANCY_AND_MODULES.md`**
- First-client rhythm: **`docs/FIRST_CLIENT_ONBOARDING_6W.md`**

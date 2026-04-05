# Before your first client go-live — Vercel & email reminder

Use this as a quick **“did I set this up?”** pass **before** you onboard a customer (or turn on automated invite email). Full detail stays in **`docs/DEPLOYMENT.md`**.

---

## 1. Vercel — platform app (`apps/platform-app`)

In **Vercel → your platform project → Settings → Environment Variables** (Production at minimum), confirm:

| Variable | Why |
|----------|-----|
| **`DATABASE_URL`** | Points at the same Postgres (e.g. Neon) you’ll use in prod. |
| **`AUTH_SECRET`** | Required for sign-in sessions (`openssl rand -base64 32`). |
| **`AUTH_URL`** | Canonical app URL (e.g. `https://app.anang.ai`) — stabilizes OAuth redirects and invite links. |
| **`PLATFORM_LOGIN_PASSWORD`** / **`PLATFORM_VIRTUAL_EMAIL`** | Pilot password path until clients are on SSO only (rotate from defaults). |
| **`AUTH_OIDC_*`** | Only if you use platform-wide SSO; per-tenant OIDC uses admin UI + `AUTH_OIDC_CLIENT_SECRET__…`. |

After changes: **redeploy** so the runtime sees new values.

---

## 2. Transactional email (when you’re ready — not required on day one)

Until this is set, **invite links still work**: `/admin` shows the link to copy manually; you don’t need Resend or SendGrid.

When you want **automatic invite email** (optional):

1. **Domain + mailbox**  
   Set up something you’re allowed to send from API mail, e.g. **`noreply@anang.ai`** or **`invites@anang.ai`**, after your provider verifies **`anang.ai`** (DNS / dashboard).

2. **Provider** (pick one)  
   - **Resend:** add **`RESEND_API_KEY`**, and **`RESEND_FROM_EMAIL`** e.g. `Anang <noreply@anang.ai>` or `Invites <invites@anang.ai>`.  
   - **SendGrid:** add **`SENDGRID_API_KEY`** and **`SENDGRID_FROM_EMAIL`** (only used if Resend key is not set).

3. **Vercel**  
   Add those variables to the **same** platform project and redeploy.

Reference: **`docs/DEPLOYMENT.md`** → *Transactional email (optional)*.

---

## 3. One-line memory hook

**Before onboarding a client:** Vercel has **`DATABASE_URL`**, **`AUTH_SECRET`**, **`AUTH_URL`**, and (if using mail) **`RESEND_FROM_EMAIL`** / **`RESEND_API_KEY`** (or SendGrid equivalents) aligned with **`noreply@anang.ai`** (or `invites@...`) once your domain is verified with the provider.

---

*This file is a reminder only; it is not legal or security advice.*

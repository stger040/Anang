# Platform app — structured logging (PHI-safe)

## What this is

The platform app emits **JSON lines** to `stdout` for **Pay / Stripe** and **auth** API routes via **`platformLog`** in `apps/platform-app/src/lib/platform-log.ts`. Each line is one object with `ts`, `level`, `event`, `service`, and event-specific fields.

## Request correlation

**`middleware.ts`** assigns **`x-request-id`** on **`/api/*`**, **`/admin/*`**, **`/o/*`**, **`/invite/*`**, **`/login`**, and **`/post-signin`** (reuses inbound `x-request-id` or `x-correlation-id` when present, else generates a UUID). The same value is echoed on the **response** header for clients and proxies.

Route Handlers should pass **`readRequestId(req)`** from `@/lib/platform-log` into `platformLog` fields as **`requestId`** so checkout + webhook lines can be tied to one HTTP request (and often to a Stripe retry chain if you search by `stripeCheckoutSessionId`).

## Rules (especially in production)

- **Do not** log PHI/PII: patient names, DOB, MRNs, addresses, clinical text, full card numbers, raw eligibility payloads.
- **Do** log stable identifiers: `tenantId`, `orgSlug`, `statementId`, `paymentId`, `stripeCheckoutSessionId`, Stripe `event.id`, amounts in **cents**, error **messages** that you know contain no PHI.

## Events (current)

| `event` | When |
|---------|------|
| `pay.checkout.created` | Checkout session created (staff-initiated flow). |
| `pay.checkout.no_url` | Stripe returned no redirect URL. |
| `stripe.webhook.received` | Webhook signature OK (all event types). |
| `stripe.webhook.verify_failed` | Signature verification failed. |
| `pay.stripe.checkout_completed.bad_metadata` | `checkout.session.completed` missing `tenantId` / `statementId`. |
| `pay.stripe.statement_not_found_in_webhook` | Statement row missing for metadata. |
| `pay.stripe.payment_posted` | Payment row + statement balance updated (success path). |
| `pay.stripe.webhook_transaction_failed` | DB transaction failed and no payment row exists (unexpected). |
| `pay.line_explain.completed` | Statement line “Explain charge” finished; `tenantId`, `orgSlug`, `statementId`, `lineId`, `source` (`openai` \| `template`). |
| `auth.flow_intent.bad_body` | **`POST /api/auth/flow-intent`** body is not valid JSON. |
| `auth.flow_intent.stored` | Flow-intent cookies set (`tenantId` if org resolved, flags only — no raw invite token). |
| `auth.logout.cookies_cleared` | **`POST /api/auth/logout`** cleared session cookies. |
| `auth.tenant_oidc.start_aborted` | Tenant OIDC **start** redirected to login (`reason`, optional `tenantSlug`). |
| `auth.tenant_oidc.redirect_issued` | Start succeeded — redirect to IdP (`tenantSlug`, `pendingInvite`). |
| `auth.tenant_oidc.callback_failed` | Callback redirect to login (`reason`, optional `tenantSlug`). |
| `auth.tenant_oidc.session_issued` | Callback succeeded — platform session cookie issued (`tenantId`, `jitCreatedUser`, `jitCreatedMembership`, `pendingInvite`). |
| `auth.nextauth.sign_in` | NextAuth **`signIn`** event — **credentials** or **global** OIDC (`provider`, `userId`, `isNewUser`). Not used for per-tenant OIDC start/callback. |
| `auth.nextauth.sign_out` | NextAuth **`signOut`** event (`userId` from JWT when present). |
| `integration.fhir_fixture.import_ok` | FHIR bundle import saved patient + encounter (optional Pay statement); `tenantId`, `orgSlug`, `encounterId`, optional `statementId`, `fromClaim`, `fhirFx*` / `fhirEob*` when present. |
| `prior_auth.case.created` | Staff or encounter-origin **PriorAuthCase** created; `tenantId`, `orgSlug`, `caseId`, optional `encounterId` / `claimId`, `requestId` when present. |
| `prior_auth.case.submitted` / `prior_auth.case.approved` / `prior_auth.case.denial` / `prior_auth.case.status_changed` | PA status transitions (info/warn level varies). |
| `prior_auth.case.linked_encounter` / `prior_auth.case.linked_claim` | Case linkage updates. |
| `prior_auth.case.overdue` / `prior_auth.case.expiring_soon` | Cron SLA scan (`/api/cron/prior-auth-sla-scan`); includes `caseId`, linked ids when set. |

**Prior auth audits** (tenant `AuditEvent`): `prior_auth.case.created`, `prior_auth.case.status`, `prior_auth.case.linked_encounter`, `prior_auth.case.linked_claim`, `prior_auth.case.checklist`, `prior_auth.case.event`, `prior_auth.case.overdue`, etc. — see **`docs/PRIOR_AUTHORIZATION.md`**.

## Auditing

Some flows also write **`AuditEvent`** rows (e.g. `pay.stripe.checkout_initiated`, `pay.stripe.payment_posted`) for tenant-scoped review in product or exports. Pay-related rows include **`requestId`** when the middleware set `x-request-id`, and **`stripeEventId`** on webhook-posted payments (Stripe `event.id`).

**Server Actions** under **`/o/*`** and **`/admin/*`** can call **`readRequestIdFromHeaders()`** from `@/lib/platform-log` so audit metadata matches the browser navigation (same `x-request-id` as the response). **Settings** (`settings.implementation.saved`, `integration.fhir_fixture.imported`), **Build / Cover / Support** server actions, and **admin** flows (`platform.tenant.created`, `platform.membership.upserted`, `platform.invite.created`, `platform.tenant_auth.updated`) include **`requestId`** when present.

**Invite fulfillment** (`platform.invite.consumed`) receives **`requestId`** via **`fulfillInviteForUser(..., { requestId })`** from **`/invite/[token]`** and **`/post-signin`** when middleware set the header. **Tenant OIDC callback** JIT audits (`auth.oidc.jit_user_created`, `auth.oidc.jit_membership_created`) include **`requestId`** from **`readRequestId(req)`**.

## Operations

Point Vercel **Log Drain** (or your collector) at the platform project; filter or alert on `level=error` and `event` prefixes you care about (`pay.stripe.*`, `stripe.webhook.*`, `auth.tenant_oidc.*`, `auth.flow_intent.*`, `integration.fhir_fixture.*`).

---

*Last updated: 2026-04-24 — prior auth `platformLog` / audit event names.*

*This is a minimal Q1-style baseline—not a full SIEM or HIPAA attestation.*

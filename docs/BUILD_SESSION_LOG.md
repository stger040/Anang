# Build session log

Short snapshots after engineering passes so ownership and readiness stay visible.

## 2026-03-29 — Super-admin provisioning

- **Shipped:** `/admin/tenants/new` (create tenant + module entitlements + audit) and `/admin/tenants/[slug]` (list members, add/update membership + audit). Helpers: `src/lib/platform-slug.ts`.
- **Phase:** Still pre–first client; improves **Phase A** operability (multi-tenant testing without manual SQL).
- **Not done:** SSO, per-tenant EHR credentials, email invites, fine-grained departmental RBAC beyond `TENANT_ADMIN` / `STAFF`.

## 2026-03-29 — First-client implementation hub + FHIR fixture import

- **Shipped:** `/o/[orgSlug]/settings/implementation` — persisted **weeks 1–3** billing + IT checklists, contacts, EHR context, milestone notes (`Tenant.settings.implementation` v1); **FHIR R4 Bundle** paste → **Patient + Encounter** when **BUILD** module is on (`integration.fhir_fixture.imported` audit). Docs: `docs/FIRST_CLIENT_ONBOARDING_6W.md`.
- **Phase:** Matches **IMPLEMENTATION_PLAN** Phase 8 (implementation assets) + **0.5** rehearsal without a live Dentrix/EHR in dev.
- **Not done:** Real per-tenant EHR connectors, automated sync, departmental RBAC.

## 2026-03-29 — Enterprise SSO (OpenID Connect) + Auth.js

- **Shipped:** **Auth.js** (`next-auth` v5) — `AUTH_SECRET`, `AUTH_URL`, optional **`AUTH_OIDC_*`** (OIDC) + **Credentials** (staging password) in `src/auth.ts`; edge **middleware** uses `auth.config.ts` only; **`/post-signin`** post-auth routing; **`SessionProvider`** in root layout; removed **`/api/auth/login`**. Super-admin gate duplicated in **`admin/layout.tsx`** (JWT claims fully applied in Node).
- **Phase:** **IMPLEMENTATION_PLAN** Phase 0.3 / buyer IT expectations; SAML-specific flows can be added via IdP that speaks OIDC or a future SAML bridge.
- **Not done:** SCIM provisioning, per-tenant multiple IdPs, SAML metadata upload UI.

## 2026-03-29 — Per-tenant OIDC + auth policy (no global SSO gate)

- **Shipped:** `Tenant.settings.auth` v1 — `local_only` / `sso_allowed` / `sso_required`; optional per-tenant issuer + client id; secret via **`AUTH_OIDC_CLIENT_SECRET__{SLUG}`**; routes **`/api/auth/tenant-oidc/[orgSlug]`** + **`callback`** (PKCE); credentials provider honors **`tenantSlug`** and blocks password for **`sso_required`** orgs; **`/login?org=`** + admin form under **`/admin/tenants/[slug]`**; docs **`docs/CLIENT_IT_OIDC_ONBOARDING.md`**, **`DEPLOYMENT.md`** + **`TENANCY_AND_MODULES`** updates.
- **Phase:** **BUILD_PLAN** §8 **Q1** “Multi-tenant auth” — operational path for pilots (internal login + optional customer IdP on their schedule).
- **Not done:** SCIM, SAML metadata UI, multiple IdPs per tenant.

## 2026-03-29 — Optional JIT on tenant OIDC

- **Shipped:** `Tenant.settings.auth.jitProvisioning` + **`jitMembershipRole`** (`STAFF` | `TENANT_ADMIN`); tenant OIDC callback creates user and/or membership when enabled; enforces membership for tenant SSO when JIT is off (`sso_no_tenant_membership`); audit **`auth.oidc.jit_user_created`** / **`auth.oidc.jit_membership_created`**; admin UI + doc updates.
- **Phase:** Still **Q1** production foundation — reduces manual `/admin` user churn for pilots with trusted IdPs.
- **Not done:** JIT for platform-wide OIDC, SCIM, outbound email for invites.

## 2026-03-29 — Tenant-aware post-signin + invite links

- **Shipped:** **`/post-signin`** honors **`?org=`** and **`?invite=`** (and httpOnly cookies via **`POST /api/auth/flow-intent`** + **`SyncAuthFlowIntent`** on `/login`). Super admins with **`?org=`** land in that tenant workspace. **`UserInvite`** model + **`/admin/tenants/[slug]`** “Create invite link” + **`/invite/[token]`** landing; **`fulfillInviteForUser`** upserts membership and consumes invite; tenant OIDC carries **`?invite=`** through PKCE cookie. Login errors **`invite_invalid`**, **`invite_email_mismatch`**.
- **Phase:** **Q1** onboarding ergonomics.
- **Not done:** SCIM.

## 2026-03-29 — Invite delivery email (Resend / SendGrid)

- **Shipped:** **`lib/invite-email.ts`** — optional **`RESEND_API_KEY`** (preferred) or **`SENDGRID_API_KEY`**; **`createTenantInvite`** sends after DB write; audit **`emailDelivery`** + failure snippet; admin UI shows sent / skipped / failed; **`DEPLOYMENT.md`** + **`.env.example`**.
- **Not done:** Branded templates, queue/retry, patient-facing mail.

## 2026-03-29 — Structured logging + Pay audit (Stripe)

- **Shipped:** **`lib/platform-log.ts`** — JSON lines, no-PHI contract; **`POST /api/payments/stripe/checkout`** logs **`pay.checkout.*`** + audit **`pay.stripe.checkout_initiated`**; **`POST /api/webhooks/stripe`** logs webhook receipt + **`pay.stripe.*`** + audit **`pay.stripe.payment_posted`** on successful post. Docs **`docs/PLATFORM_LOGGING.md`**.
- **Phase:** **BUILD_PLAN** Q1 — light “HIPAA-aware ops” habit for Pay without dumping PHI to logs.
- **Not done:** Full-app `platformLog` coverage, centralized redaction, patient comms logging.

## 2026-03-29 — `x-request-id` middleware + Pay log correlation

- **Shipped:** **`middleware.ts`** matcher adds **`/api/:path*`**; preserves or generates **`x-request-id`** (also accepts **`x-correlation-id`**); Stripe checkout + webhook **`platformLog`** lines include **`requestId`** via **`readRequestId(req)`**. **`PLATFORM_LOGGING.md`** updated.
- **Not done:** Propagate `requestId` into non-Pay audits / server components without `Request`.

## 2026-03-29 — Audit metadata: `requestId` + `stripeEventId` (Pay)

- **Shipped:** `pay.stripe.checkout_initiated` metadata includes optional **`requestId`**; **`pay.stripe.payment_posted`** includes **`requestId`**, **`stripeEventId`**, existing payment/statement/session fields.

## 2026-03-29 — FHIR import → Pay sandbox statement

- **Shipped:** When **PAY** is entitled, **`importFhirFixtureFromSettings`** also creates an **`open`** statement + one line (**$250.00** sandbox, 30-day due) for the imported patient; audit **`integration.fhir_fixture.imported`** gains **`payStatementCreated`**, **`statementId`**, **`statementBalanceCents`**; **`revalidatePath`** Pay; Implementation hub copy + success message updated.
- **Phase:** **Q2** rehearsal without live EHR feed.
- **Not done:** Real 837/charge feed.

## 2026-04-03 — FHIR R4 Claim → statement lines

- **Shipped:** **`fhir-fixture-import`** detects **Claim** resources whose **`patient`** matches the bundled Patient (`id` or MRN ref); maps **`item[].net`** (Money → USD cents) + **`productOrService`** into **`claimStatement.lines`** (max 50). **`importFhirFixtureFromSettings`** uses **createMany** lines + **`FHIR-CLM-…`** number when present; else **$250** stub. Audit **`statementSource`**: `fhir_r4_claim` | `sandbox_stub`, optional **`fhirClaimId`**.
- **Not done:** EOB/835 linkage *(multi-claim + ISO **Money** moved to **2026-03-29 — FHIR Claim: multi-claim + ISO 4217 Money**).*

## 2026-03-29 — FHIR Claim: multi-claim + ISO 4217 Money

- **Shipped:** **`extractClaimStatement`** merges up to **20** matching **Claim** resources (sorted by `id`), prefixes line codes **`C1-`…** when multiple, still caps **50** lines. **`moneyToMinorUnits`** uses **ISO 4217** minor decimals; missing **`currency`** treated as **USD**. Statement **`FHIR-CLM-MULTI-…`** when merged; audit **`fhirClaimCount`**, **`fhirClaimIds`**. **`claimLogicalId`** only when exactly one claim resource with an **`id`**. Helpers **`claimMatchesPatient`**, **`parseClaimLineItems`**. **Non-USD → USD cents:** see **FHIR fixture FX** entry.
- **Not done:** Live-ticker FX / treasury-grade rates, X12 **835** ingestion.

## 2026-03-29 — FHIR fixture FX → USD cents (Pay)

- **Shipped:** **`lib/fhir-fx.ts`** — **`foreignMinorToUsdCents`** (USD/USN pass-through), env **`FHIR_IMPORT_FX_RATES_JSON`** (USD per major unit) overrides built-ins; unknown currency + no rate → line skipped + ledger. **`parseClaimLineItems`** stores **USD cents** on lines; **`claimStatement.fhirFx`** (**`skippedLineCount`**, **`usedEnvRates`**, **`usedBuiltinRates`**); audit **`fhirFxSkippedLines`** / **`fhirFxUsedBuiltin`** / **`fhirFxUsedEnv`**. **`.env.example`** + implementation form blurb.

## 2026-03-29 — Integration status: `fhirFixtureImport`

- **Shipped:** **`getIntegrationStatus()`** adds **`fhirFixtureImport`** (`mock` vs `test_ready` when strict or custom FX JSON). Tenant **Settings → Integration readiness** lists it; **`DEPLOYMENT.md`** documents **`FHIR_IMPORT_*`** alongside Stripe.

## 2026-03-29 — FHIR import: FX strict mode + import log line

- **Shipped:** **`resolveFhirImportFxStrict`** + env **`FHIR_IMPORT_FX_STRICT`** (`1`/`true`/`yes`). **`normalizeFhirBundlePayload(json, options?)`** rejects when strict and (a) matching **Claim**s yield no billable lines, or (b) any non-USD line omitted for missing rate. **`extractClaimStatement`** returns **`ClaimExtractResult`**. **`integration.fhir_fixture.import_ok`** **`platformLog`** (tenant, org, Pay flags, optional FX/EOB counters, **`requestId`**). Request id read once per import. **`.env.example`**, **`PLATFORM_LOGGING.md`**, form copy.

## 2026-03-29 — FHIR R4 ExplanationOfBenefit (fixture trace)

- **Shipped:** **`extractExplanationOfBenefitBundle`** — up to **15** **ExplanationOfBenefit** resources matching the bundled patient; collects **`id`s**, deduped **`claim`** reference tails, **`outcome`** codes. **`NormalizedFhirPatientEncounter.explanationOfBenefit`**; **`visitSummary`** appends EOB count; **`integration.fhir_fixture.imported`** metadata **`fhirEobResourceCount`**, **`fhirEobIds`**, **`fhirEobLinkedClaimIds`**, **`fhirEobOutcomes`**. Implementation form note. Does **not** adjust Pay lines (rehearsal / audit only).

## 2026-03-29 — Audit `requestId` from Server Actions (settings + tenant + admin)

- **Shipped:** **`readRequestIdFromHeaders()`** in **`platform-log`** (Next **`headers()`**, same fallback order as **`readRequestId`**). Audits include optional **`requestId`** for: **`settings.implementation.saved`**, **`integration.fhir_fixture.imported`**, **`build.draft.approved`**, **`cover.case.created`** / **`cover.case.status`**, **`support.task.created`** / **`support.task.status`**, **`platform.tenant.created`**, **`platform.membership.upserted`**, **`platform.invite.created`**, **`platform.tenant_auth.updated`**. **`PLATFORM_LOGGING.md`** updated; removed stray **`;;`** in settings actions.

## 2026-03-29 — Audit `requestId`: invite consume + OIDC JIT + middleware coverage

- **Shipped:** **`fulfillInviteForUser`** optional **`opts?: { requestId?: string }`**; **`/invite/[token]`** and **`/post-signin`** pass **`readRequestIdFromHeaders()`**. **`middleware.ts`** matcher adds **`/invite/:path*`** (public **`continueWithRequestId`**) and **`/post-signin`** so headers exist on those RSC requests. Tenant OIDC **`callback`** **`GET`** adds **`requestId`** to **`auth.oidc.jit_user_created`** and **`auth.oidc.jit_membership_created`**. Docs updated.

## 2026-03-29 — Middleware: `/login` gets `x-request-id`

- **Shipped:** **`middleware.ts`** matches **`/login`** with public **`continueWithRequestId`** (same as **`/invite`**). **`PLATFORM_LOGGING.md`** updated.

## 2026-03-29 — `platformLog`: auth API routes

- **Shipped:** **`POST /api/auth/flow-intent`** (`auth.flow_intent.*`), **`POST /api/auth/logout`** (`auth.logout.cookies_cleared`), tenant OIDC **start** (`auth.tenant_oidc.start_aborted` / `redirect_issued`, **`discovery_failed`** → login `oidc_token`), **callback** (`auth.tenant_oidc.callback_failed` with **`reason`**, **`auth.tenant_oidc.session_issued`** with JIT flags). Callback wraps issuer discovery in **try/catch**. **`PLATFORM_LOGGING.md`** event table updated.

## 2026-03-29 — `platformLog`: NextAuth `events` (`auth.ts`)

- **Shipped:** **`auth.nextauth.sign_in`** / **`auth.nextauth.sign_out`** via **`events`** on the merged NextAuth config (**credentials** + **global** OIDC only; per-tenant OIDC remains **`auth.tenant_oidc.*`**). Logs **`userId`** + **`provider`** — no email.

## 2026-04-03 — Pay rehearsal + FHIR EOB regression

- **Shipped:** **`/o/{orgSlug}/pay/patient-preview`** (staff-only plain-language balance cards) + link from Pay hub; monorepo **`npm test`** → **`vitest`** in **platform-app** (**`fhir-fx`**, **Claim**, **EOB**, multi-claim). **`normalizeFhirBundlePayload`** Vitest for **ExplanationOfBenefit** (single, multi, wrong-patient exclusion, **Claim + EOB** in one bundle); import success **`fhirEobResourceCount`** + implementation hub banner; **`PATIENT_SCENARIOS_AND_MOBILE_APP.md`** preview pointer.
- **Not done:** **835** ingestion, live FX, full **`platformLog`** coverage.

## 2026-04-03 — Build: FHIR fixture cues in queue & encounter

- **Shipped:** **`parseFhirVisitSummaryMeta`** (fixture marker + EOB count from **`visitSummary`**); **Build → queue** “Source” column (**FHIR fixture** / **EOB × N** badges); encounter detail **Fixture import** callout for imported visits. Vitest for parser.
- **Not done:** Structured **`Encounter`** metadata JSON for fixtures (still string-embedded cues only).

## 2026-04-03 — Pay: FHIR fixture statement labeling

- **Shipped:** **`isFhirFixtureImportStatementNumber`** (`FHIR-` prefix from implementation import); **statement detail** rehearsal callout; **Pay** list **FHIR** badge on number; **patient-preview** **Demo · FHIR import** badge. Vitest for prefix helper.
- **Not done:** DB **`statementSource`** column (still convention on **`number`**).

## 2026-04-03 — FHIR import: deep links + audit encounter id

- **Shipped:** Successful import returns **`importedEncounterId`** / **`importedStatementId`** (IDs assigned only after the DB transaction commits). **Implementation** success banner links to **Build → encounter**, **Pay → statement** (when Pay on), and **Build queue**. **`integration.fhir_fixture.imported`** + **`integration.fhir_fixture.import_ok`** include **`encounterId`** when present. **`PLATFORM_LOGGING.md`** table updated.

## 2026-04-03 — Support + Pay paid: FHIR statement cues

- **Shipped:** **Support** statement picker labels and queue rows show **FHIR** for **`FHIR-…`** numbers; **statement paid** (“thank you”) page shows **FHIR fixture rehearsal** when applicable. **`FIRST_CLIENT_ONBOARDING_6W.md`** test-data row updated (Claim/EOB, deep links, patient preview, **`FHIR_IMPORT_*`** pointer).

## 2026-04-03 — Insight + settings + deployment: FHIR rehearsal map

- **Shipped:** **Insight** “Statements open balance” hint counts **`FHIR-…`** fixture statements when present. **Settings → Integration readiness** links under **FHIR fixture import** to **Implementation hub**. **`DEPLOYMENT.md`** — paragraph mapping env + product surfaces (**Build**/**Pay**/**Support**/patient preview + doc links).

## 2026-04-03 — Shipped minimal FHIR example Bundle + status path

- **Shipped:** **`apps/platform-app/fixtures/fhir/minimal-patient-encounter-claim.example.json`** (Patient + Encounter + USD Claim). Vitest loads it from **`process.cwd()`**. **`getIntegrationStatus()`** / **`GET /api/integrations/status`** expose **`fhirFixtureImport.exampleBundlePath`**. **Settings** shows repo path; **Implementation** form + **`DEPLOYMENT.md`** + **`EPIC_AND_TEST_DATA.md`** point to the file.

## 2026-04-03 — Medical AI 1.0 slice: explain charge + CI

- **Shipped:** **`lib/bill-line-explain.ts`** — template fallback; optional **OpenAI** Chat Completions (**`OPENAI_API_KEY`**, **`OPENAI_CHAT_MODEL`**). **`POST /api/pay/explain-line`** (tenant + PAY + line ownership). Pay **statement detail** table column **Education** + **`StatementLineExplain`** client UI. **`medicalAiBillExplain`** on **`getIntegrationStatus()`** / **Settings → Integration readiness**. **`PLATFORM_LOGGING.md`**, **`.env.example`**, **`DEPLOYMENT.md`**. GitHub Actions **`.github/workflows/ci.yml`** (**`npm ci`**, **`lint`**, **`test`**). Vitest **`bill-line-explain.test.ts`**.
- **Not done:** Patient-only portal chat, RAG over CPT library, rate limits on explain endpoint, BAA-specific model hosting.

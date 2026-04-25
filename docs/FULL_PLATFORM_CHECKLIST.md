# Full platform checklist (Cedar-class + Anang differentiators)

**Company:** Anang — [anang.ai](https://anang.ai). This is the **master execution list**. Detail: **`IMPLEMENTATION_PLAN.md`**; engineering: **`BUILD_PLAN.md`**; context for new contributors: **`PLATFORM_OVERVIEW.md`**.

**Modules & vision:** [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) · [`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md) · [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md).

**Business / ops:** [`DEVELOPMENT_NEEDS.md`](./DEVELOPMENT_NEEDS.md).

## Foundation

- [ ] Mono-repo, CI, dev/staging/prod
- [ ] Multi-tenant data model + auth (SSO roadmap)
- [ ] HIPAA baseline (encryption, audit, BAAs)
- [x] `/api/health` + `/api/version` (platform app — `serviceId` from `@anang/brand`)
- [ ] **`packages/brand`** — final company/product/AI names

## Patient experience (Pay + Pre)

- [ ] Statements from charges / EHR feed (today: seed / demo data in platform-app)
- [ ] **Patient billing web** — magic links, calming layout, verify-by-SMS/email-on-file (**`PATIENT_SCENARIOS_AND_MOBILE_APP`**)
- [ ] Patient portal + **installable PWA** + **native** iOS / Android (store distribution) — **parity** with Pay / Cover / Support per **`PRODUCT_SURFACES_VISION`**
- [ ] Payments (**Stripe** test path + webhook in **platform-app** when env set; extend to patient shell + enterprise gateway)
- [ ] Plans, discounts, HSA/FSA display
- [x] Staff **pre-visit hub** route (`/pay/pre`) — placeholder until appointment feed
- [ ] Pre-visit estimates + **GFE / transparency** (legal review) — product story **with Pay** (`MODULES_CUSTOMER`); optional future `PRE` key
- [ ] Omnichannel: email, **SMS (short code / 10DLC)**, paper (TCPA/CAN-SPAM)
- [ ] Medical AI: explain line items + chat (**patient assistant** name from brand)

## Dental vertical (Cedar Orthodontics–class)

**Definition:** Same platform modules as acute care, **packaged and configured** for dental / ortho: **DMS/PMS** integrations, **CDT**-aligned billing and claim thinking, **treatment-plan** and **installment** patterns, **family/guarantor** statements — see **`docs/MODULES_CUSTOMER.md`** § *Dental vertical* and **`docs/PATIENT_SCENARIOS_AND_MOBILE_APP.md`** (dental patient slice).

- [ ] **Entitlement** — optional dedicated **`DENTAL`** `ModuleKey` + admin UI (today: **`Tenant.settings`** / flags only)
- [ ] **Connectors** — Dentrix-class and peer **dental PM** ingest paths (FHIR/export) documented beyond generic EHR; CDT line mapping in Build / Pay where needed
- [ ] **Patient & staff UX** — dental-specific **Pay** copy/layout, schedule/installment overlays per **`PRODUCT_SURFACES_VISION`**
- [ ] **GTM** — dental SKU / pilot SOW template distinct from hospital **`BUILD_PLAN.md` §11** when you open ortho/dental

## Coverage & aid (Cover)

- [x] Staff intake queue + case statuses (`CoverAssistanceCase` — demo)
- [ ] Medicaid / ACA workflows
- [ ] Renewals + financial assistance screening
- [ ] **Reactive** patient denials (CoB, dual coverage)
- [ ] Live advocate handoff where needed

## Revenue cycle (Connect + RCM)

- [ ] Clearinghouse: 837, 835, 277
- [ ] **Claims Build** + **Claims Copilot** (provider AI; name from brand)
- [ ] Eligibility 270/271
- [x] **Prior auth tracking (medical benefit, staff)** — **Connect → Authorizations**: cases, checklist, services, events, encounter/claim/coverage links, SLA-style queue flags, audit + `platformLog`; **Build** deterministic **`prior_auth`** rule issues + encounter CTA to create prefilled case; **Implementation hub** `priorAuth` settings; cron **`/api/cron/prior-auth-sla-scan`**; **not** pharmacy ePA, **not** payer auto-submit — see **[`PRIOR_AUTHORIZATION.md`](./PRIOR_AUTHORIZATION.md)**
- [ ] **RCM denials** work queue (payer-side, not patient Cover)
- [ ] Cash posting, refunds, credit balances, agency handoff

## Support & voice

- [x] Support task queue + priorities (`SupportTask` — demo)
- [ ] Agent workspace + copilot
- [ ] Early-out / outbound campaigns
- [ ] **Voice agent** (name from brand)

## Intelligence

- [ ] Event pipeline + dashboards
- [ ] Propensity + personalization + experiments

## Platform

- [ ] Public API + webhooks
- [ ] White-label (per tenant: already in DB; global brand in `@repo/brand`)
- [ ] i18n + accessibility
- [ ] Feature flags per tenant

## GTM

- [ ] Trust pack, demo tenants, pilot SOW (**`BUILD_PLAN.md` §11**)
- [ ] First EHR: sandbox → production per customer

## Test data (no “open Epic” required)

See **`docs/EPIC_AND_TEST_DATA.md`** — Synthea, FHIR fixtures, vendor sandboxes.

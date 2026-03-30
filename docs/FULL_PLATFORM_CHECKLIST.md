# Full platform checklist (Cedar-class + Anang differentiators)

**Company:** Anang — [anang.ai](https://anang.ai). This is the **master execution list**. Detail: **`IMPLEMENTATION_PLAN.md`**; engineering: **`BUILD_PLAN.md`**; context for new contributors: **`PLATFORM_OVERVIEW.md`**.

**Business / ops:** [`DEVELOPMENT_NEEDS.md`](DEVELOPMENT_NEEDS.md).

## Foundation

- [ ] Mono-repo, CI, dev/staging/prod
- [ ] Multi-tenant data model + auth (SSO roadmap)
- [ ] HIPAA baseline (encryption, audit, BAAs)
- [ ] `/api/health` + `/api/version` (wired to `@repo/brand` `technical.serviceId`)
- [ ] **`packages/brand`** — final company/product/AI names

## Patient experience (Pay + Pre)

- [ ] Statements from charges / EHR feed
- [ ] Patient portal + PWA
- [ ] Payments (Stripe or enterprise gateway)
- [ ] Plans, discounts, HSA/FSA display
- [ ] Pre-visit estimates + **GFE / transparency** (legal review)
- [ ] Omnichannel: email, SMS, paper (TCPA/CAN-SPAM)
- [ ] Medical AI: explain line items + chat (**patient assistant** name from brand)

## Coverage & aid (Cover)

- [ ] Medicaid / ACA workflows
- [ ] Renewals + financial assistance screening
- [ ] **Reactive** patient denials (CoB, dual coverage)
- [ ] Live advocate handoff where needed

## Revenue cycle (Connect + RCM)

- [ ] Clearinghouse: 837, 835, 277
- [ ] **Claims Build** + **Claims Copilot** (provider AI; name from brand)
- [ ] Eligibility 270/271
- [ ] Prior auth tracking
- [ ] **RCM denials** work queue (payer-side, not patient Cover)
- [ ] Cash posting, refunds, credit balances, agency handoff

## Support & voice

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

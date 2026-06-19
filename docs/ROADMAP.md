# Anang — Product Roadmap

**Vision:** The AI-native revenue cycle platform for U.S. health systems. Two products: **Claims AI** (stop denials before they happen) and **Patient Pay** (collect from patients with an AI agent). Sold together to healthcare administrators.

---

## Phase 0 — Foundation ✅ (current state)

### Platform infrastructure
- [x] Monorepo: marketing-site + platform-app + patient-app (Expo)
- [x] Multi-tenant Prisma schema (Neon PostgreSQL)
- [x] Next-Auth v5 with per-tenant OIDC/SSO + magic links
- [x] Module entitlement system (ModuleKey per tenant)
- [x] Stripe Checkout integration (web patient portal)
- [x] Audit logging (AuditEvent)
- [x] Super-admin console
- [x] Marketing site homepage (revamped June 2026)

### Claims AI (BUILD module)
- [x] Claims worklist UI (draft, flagged, ready, submitted)
- [x] AI suggestion runs (BuildSuggestionRun)
- [x] Encounter detail with linked claim and PA cases
- [x] Prior authorization case tracking (Connect Authorizations)
- [x] Deterministic rule layer foundation

### Patient Pay (PAY module)
- [x] Magic link token system
- [x] Web patient portal (/p/[orgSlug]/pay/[token])
- [x] Statement + charge display
- [x] Stripe Checkout for web
- [x] Bill line AI explanation (explainStatementLine)
- [x] Expo patient app scaffolded (iOS + Android)
- [x] Mobile API routes (/api/patient/*)
- [x] Stripe Payment Sheet for mobile

---

## Phase 1 — Pilot-Ready (Next 6 Weeks)

Goal: One real health system live, collecting real payments, seeing real denial prevention.

### Claims AI
- [ ] Deterministic rule engine v1 — 50 payer-specific edits covering top 10 denial reason codes
- [ ] Denial reason normalization — Parse 835 remittance CARC/RARC codes into categories
- [ ] Denial inbox — Staff workspace for routing and working denied claims
- [ ] Appeal template generator — AI drafts appeal letter from denial reason + original claim
- [ ] Shadow mode — Run AI suggestions without blocking submission; measure accuracy vs real denials
- [ ] Training data pipeline — Ingest successful claim history to tune denial prediction per payer

### Patient Pay
- [ ] Patient app: real data wiring — Coverage, home, ask-ai pulling from API (no hardcoded data)
- [ ] Payment plan flow — pay/plan.tsx calls /api/patient/acknowledge-plan
- [ ] Push notifications — Patient notified when new statement arrives
- [ ] SMS outreach — Magic link SMS when staff marks statement ready
- [ ] Web/mobile parity — Same data and actions on web and mobile

### Connectors
- [ ] FHIR R4 encounter import — Epic open sandbox (open.epic.com) for demo
- [ ] CSV fallback connector — Accept encounter/claim data as CSV upload
- [ ] 835 remittance parser — Ingest ERA files to auto-close paid statements

### Infrastructure
- [ ] BAA-ready logging — Remove PHI from application logs
- [ ] Rate limiting on patient API routes
- [ ] Stripe webhook — Handle payment_intent.succeeded to mark statement paid

---

## Phase 2 — Growth (3–6 Months)

Goal: 5 health systems live. Denial rate measurably improving. Patient collection rate measurably improving.

### Claims AI
- [ ] Predictive denial scoring — ML model per tenant trained on their claims/remittances history
- [ ] Rules editor UI — Billing supervisors add custom payer rules without engineering
- [ ] Denial trend analytics — Which payers deny most, trending over time
- [ ] Auto-appeal for common denial types — CO-4, CO-97 appeals auto-generated after staff approval
- [ ] EHR integration: Epic production — SMART on FHIR sidebar app
- [ ] EHR integration: athenahealth — REST API connector

### Patient Pay
- [ ] AI agent v2 — Multi-turn conversation; proactively suggests next action
- [ ] Medicaid/ACA screener — In-app eligibility questionnaire; routes to enrollment
- [ ] Charity care intake — Digital application, document upload, status tracking
- [ ] Payment plan installments — Auto-charge scheduled installments via Stripe
- [ ] Pre-visit estimates — Good faith estimate delivery before appointment
- [ ] Outbound campaigns — Automated follow-up sequences for unpaid balances

### Platform
- [ ] Self-service onboarding — Health system provisions themselves with Stripe subscription
- [ ] Reporting API — Webhook/export for health system's BI tools
- [ ] SOC 2 Type II controls — Evidence collection begins

---

## Phase 3 — Scale (6–18 Months)

### Claims AI — Neural Network
- [ ] Federated learning pipeline — Learn from every tenant's successful/denied claims without sharing PHI
- [ ] Payer behavior modeling — Model each payer's adjudication patterns, update monthly
- [ ] Underpayment detection — Claims paid below contracted rate; flag for secondary billing
- [ ] Prior auth automation — Predict which encounters need prior auth proactively

### Patient Pay — Full Cedar Parity
- [ ] Voice AI agent — Patient can call a number and speak to AI
- [ ] HSA/FSA integration — Patient sees balance; can pay directly
- [ ] Family billing — Guarantor view across multiple patients
- [ ] Dental vertical — CDT-native, treatment plan billing

### Epic SMART on FHIR (Demo)
- [ ] SMART app — Claims AI panel inside Epic clinical workflow
- [ ] Demo using open.epic.com — Recorded: encounter → AI flags → clean claim
- [ ] App Orchard listing — Epic marketplace

---

## Principles

1. **Measure what matters.** Denial rate before/after. Patient collection rate before/after.
2. **Learn from your own data.** AI improves per health system's payer mix, not just generic training.
3. **Human in the loop for claims.** AI never submits without staff approval.
4. **Mobile-first for patients.** Every patient UI decision: can a confused patient pay in under 3 minutes?
5. **One platform.** Claims AI and Patient Pay share tenant, data, and audit trail.

---

*Last updated: 2026-06-19*

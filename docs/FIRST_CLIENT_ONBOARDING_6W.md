# First client — 6-week onboarding shape

**Purpose:** Align the repo’s product surfaces with a realistic first engagement: **weeks 1–3** billing + IT discovery and integration prep, **weeks 4–6** hardening toward production paths. This doc is **not** a legal SOW — use your contract for obligations.

---

## Week 0 (before kickoff)

- **Environment:** staging tenant in Anang, pilot users provisioned (`/admin` or seed), **`AUTH_SECRET`** set, `PLATFORM_LOGIN_PASSWORD` rotated from defaults. If IT provides an IdP early, configure **`AUTH_OIDC_*`** and register redirect `…/api/auth/callback/oidc` — see `docs/DEPLOYMENT.md`.
- **Trust pack starter:** see `BUILD_PLAN.md` §11 — subprocessors, architecture diagram, “where data lives.”
- **Intelligence / onboarding philosophy:** onboarding = **system + schema mapping**, **rule calibration**, **retrieval setup**, **shadow mode**, **instrumentation** — **not** “train a new foundation model per client.” See **`IMPLEMENTATION_PLAN.md`** (strategic architecture) and **`docs/CORE_DATA_MODEL.md`**.
- **Build rule pack:** with **Build** on, **Settings → Implementation hub → Build — deterministic rule pack** stores per-tenant JSON to **disable** rule keys or **override severity** (pilot tuning without code deploy).
- **Connector pilot order:** **Pilot 1 — Greenway / Intergy** (first live FHIR lane); **Pilot 2 — Tamarack Health / Epic** (planned; App Orchard path). **`docs/PILOT_CONNECTOR_ROADMAP.md`** · **`docs/EPIC_FHIR_INTEGRATION_PLAN.md`**. For Greenway, complete the **research brief** in **`docs/CONNECTOR_STRATEGY.md`** before locking one API/export path.
- **Read:** `docs/EPIC_AND_TEST_DATA.md` for how to use **sandboxes and synthetic data** (you do not need Dentrix in dev to exercise the app).

---

## Weeks 1–3 — Billing + IT (joint sessions)

**In the product:** open **Settings → Implementation hub** (`/o/[orgSlug]/settings/implementation`).

| Track | What to complete |
|-------|------------------|
| **Billing discovery** | Checklist in the hub: statement sources, payer mix, payment plans, PCI/clearinghouse reality, staffing. |
| **IT / EHR** | Vendor name (e.g. Dentrix-class PM), expected interface (FHIR, HL7, API, batch), VPN/network, sandbox timing, SSO expectations, PHI-safe test plan. |
| **Contacts** | IT primary + billing/RCM lead emails for routing decisions. |
| **Test data** | If **Build** is on: paste a **FHIR R4 Bundle** (Patient + Encounter required). With **Pay** on, **Claim** **`item.net`** lines become statement rows; **ExplanationOfBenefit** is traced on the encounter (no 835). After import, the hub shows links to the **new encounter** and **statement**. **Build** queue marks **FHIR fixture** / **EOB**; **Pay** and **Support** label **`FHIR-…`** statements. Staff **patient rehearsal:** `/o/[orgSlug]/pay/patient-preview`. See **`docs/DEPLOYMENT.md`** for **`FHIR_IMPORT_*`** env (FX / strict). |

**Outside the product (your notebook / PM tool):** detailed workflow maps, payer IDs, AR aging cutoffs, and legal/BAA status — link or summarize in **milestone notes** if useful.

---

## Weeks 4–6 — Toward go-live

- **Integration:** move from fixture/import to **vendor-approved** sandbox → production interfaces per `IMPLEMENTATION_PLAN.md` Phase 0.5 / Phase 8.
- **Identity:** replace shared staging password with **SSO** for tenant staff when requirements are known (`PATH_TO_FULL_PRODUCT.md`).
- **Pay / comms:** Stripe test → live with counsel; Twilio / email with TCPA and template review (`PATIENT_SCENARIOS_AND_MOBILE_APP.md`).
- **Cutover:** go-live checklist, rollback, monitoring — expand here as you operationalize.

---

## Relationship to the main implementation plan

- **`IMPLEMENTATION_PLAN.md`** — long-horizon phases (Pay depth, Connect, Cover, etc.).
- **This file** — **first pilot** rhythm only; the **Implementation hub** in the app persists the week 1–3 operational tracking per tenant.

---

*Last updated with Implementation hub UI (tenant settings).*

# Pilot connector roadmap — Greenway (P1) → Epic / Tamarack (P2)

**Purpose:** Lock **commercial sequencing** into repo planning so engineering, onboarding, and customer IT share one story: **first live EHR feed targets Greenway / Intergy-class** deployments; **Epic** (e.g. **Tamarack Health**) is **explicitly second** with a separate compliance and app-store path.

**Related:** [`CONNECTOR_STRATEGY.md`](./CONNECTOR_STRATEGY.md), [`EPIC_FHIR_INTEGRATION_PLAN.md`](./EPIC_FHIR_INTEGRATION_PLAN.md), [`FIRST_CLIENT_ONBOARDING_6W.md`](./FIRST_CLIENT_ONBOARDING_6W.md), Greenway code `apps/platform-app/src/lib/connectors/greenway-fhir/`.

---

## Wave A — Pilot 1 (Greenway / Intergy)

**Goal:** Read/sandbox **FHIR R4** from the customer’s Greenway tenant (see [FHIR base URLs](https://developers.greenwayhealth.com/developer-platform/page/fhir-base-urls)), then incremental **Patient / Encounter** pull → canonical **`Patient` / `Encounter`** (+ future charge/claim mapping).

| Milestone | Repo / ops |
|-----------|------------|
| Research sign-off | [`CONNECTOR_STRATEGY.md`](./CONNECTOR_STRATEGY.md) Appendix A.5 filled for this customer (**SKU**, **primary path**, **sandbox**, **BAA**). |
| Env: FHIR base | `GREENWAY_FHIR_BASE_URL` **or** `GREENWAY_FHIR_ENV` + `GREENWAY_FHIR_TENANT_ID` (see `.env.example`). |
| Auth | **Manual bearer** (`GREENWAY_FHIR_ACCESS_TOKEN`) for early probes, **or** **client-credentials OAuth** (`GREENWAY_FHIR_CLIENT_ID`, `GREENWAY_FHIR_CLIENT_SECRET`, `GREENWAY_FHIR_TOKEN_URL`, optional `GREENWAY_FHIR_OAUTH_SCOPE`) — resolved automatically by Implementation hub test + cron probe when static token is unset. |
| Product checks | **Settings → Implementation hub** — **Test Patient read** + **Sync Patient + Encounters** (tenant-admin); **recent cron/hub sync activity** (audit metadata, no clinical payloads). Per-tenant **`Tenant.settings.connectors.greenwayFhir`** + **`GREENWAY_FHIR_*__SLUG`** env. Cron **`GET|POST /api/cron/greenway-fhir-sync`** + `Authorization: Bearer <CRON_SECRET>` — **single patient:** **`?patientId=`** + optional **`?tenantSlug=`** (or **`GREENWAY_FHIR_SYNC_TENANT_SLUG`**); **bulk:** **`GREENWAY_FHIR_CRON_PATIENT_IDS`** + tenant slug → one upsert per id (cap **30**). Without tenant slug: **probe-only** (BAA staging; PHI). **`Encounter?patient=`** pagination via **`Bundle.link` next**. |
| Fallback | **FHIR Bundle paste** + **CSV v1** remain valid for rehearsal and cutover rescue — same canonical tables. |

**Not a commitment in this doc:** exact **OAuth token URL** and **scopes** — those are **tenant- and app-registration–specific**; store in env per deploy after Greenway Identity / app onboarding.

---

## Wave B — Pilot 2 (Epic — Tamarack Health)

**Goal:** Treat Epic as a **second integration program**: **Epic on FHIR**, **SMART**, optional **Bulk Data**, **App Orchard** listing, org-specific FHIR URLs, and **BAA** with Epic / health system.

**Repo today:** Planning and tenant **`settings.implementation`** cues only — **no** Epic HTTP client in `platform-app` until Wave B contracts and credentials exist. See **[`EPIC_FHIR_INTEGRATION_PLAN.md`](./EPIC_FHIR_INTEGRATION_PLAN.md)**.

---

## Seed / demo tenants (storytelling)

| Slug | EHR note in seed `settings.implementation` |
|------|---------------------------------------------|
| `lco` | Greenway / Intergy pilot framing |
| `hayward`, `ashland` | Tamarack — Epic planned (P2) |

---

*Non-negotiable:* **PHI** only in **BAA-covered** environments; correlation IDs in logs, not clinical payloads — [`PLATFORM_LOGGING.md`](./PLATFORM_LOGGING.md).

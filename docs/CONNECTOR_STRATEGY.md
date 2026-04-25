# Connector & integration strategy — Anang

**Purpose:** Treat **connectors as first-class product infrastructure**: repeatable patterns, tenant-level mapping, and a path from **vendor sandbox → production** without hardcoding one integration style.

**Product context:** Anang is an **AI-powered revenue-cycle intelligence layer** that sits **beside** EHRs, PM systems, clearinghouses, and payer workflows — **not** a replacement EHR.

**Related:** [`CORE_DATA_MODEL.md`](./CORE_DATA_MODEL.md) (where connector output lands), [`FIRST_CLIENT_ONBOARDING_6W.md`](./FIRST_CLIENT_ONBOARDING_6W.md) (pilot rhythm), [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) (long-horizon phases).

## Commercial pilot sequence (authoritative)

| Wave | Customer / system | Role in repo |
|------|-------------------|--------------|
| **Pilot 1** | **Greenway / Intergy** EHR | First production-style **FHIR R4** lane: `apps/platform-app/src/lib/connectors/greenway-fhir/`, Implementation hub test, secured cron probe. Env: `.env.example`. **Roadmap:** [`PILOT_CONNECTOR_ROADMAP.md`](./PILOT_CONNECTOR_ROADMAP.md). |
| **Pilot 2** | **Tamarack Health** (Epic) | **Planned** — Epic on FHIR / App Orchard / org endpoints; no live worker until BAA + app approval. **Plan:** [`EPIC_FHIR_INTEGRATION_PLAN.md`](./EPIC_FHIR_INTEGRATION_PLAN.md). |

---

## 1. Connector categories

| Category | Examples | Typical artifacts | Lands in (canonical) |
|----------|----------|-------------------|----------------------|
| **EHR / PM clinical & demographics** | Greenway, Intergy-class PM, Epic, athena; **dental DMS/PMS** (e.g. Dentrix-class, Open Dental–class) per **`docs/MODULES_CUSTOMER.md`** *Dental vertical* | FHIR R4, proprietary APIs, HL7 v2, vendor exports | `Patient`, `Encounter`, providers/facilities |
| **EHR / PM charges & claim prep** | Same vendors + billing modules; **dental** often **CDT**-centric lines | Charge exports, claim excerpts, APIs | `ClaimDraft` lines / future **Charge** rows |
| **Claims submission & lifecycle** | Clearinghouse, direct payer | 837, 277, portals | `Claim`, **claim lines**, `ClaimTimelineEvent` ✳ |
| **Prior authorization (medical benefit)** | Staff workflow today; payer portals / ePA **later** | Manual status + attachments metadata in product | **`PriorAuthCase`** (+ children) under **Connect → Authorizations** — **`docs/PRIOR_AUTHORIZATION.md`** |
| **Pharmacy e-claims (optional)** | Switch, PBM feeds | NCPDP Telecommunication / batch (see Appendix B) | Same **`Claim`** timeline pattern or future pharmacy-specific entities — **contract-gated** |
| **Remittance & denials** | 835 ERA, payer portals, workbench CSV | 835, downloadable CSV | **Remittance**, **adjustment**, **denial** (future tables) |
| **Patient financial / AR** | Statement print files, PM AR export | PDF/CSV, API | `Statement`, `StatementLine` |
| **Identity / SSO** | Okta, Entra | OIDC | Existing auth (`Tenant` + memberships) |

✳ *Partially implemented today.*

---

## 2. Priority order (recommended)

1. **Canonical data model + idempotent upsert pattern** — Every connector must map into the same tenant-scoped entities (see core data model doc).
2. **First PM/EHR path for pilot** — Driven by first contract; see §4 (Greenway / Intergy).
3. **CSV / batch fallback** — Always available for go-live rescue and shadow validation.
4. **Claims + remittance ingestion** — Required for serious Connect and Build loop closure.
5. **Clearinghouse partner connector** — Phase after internal parsers and ops runbooks exist.

---

## 3. Design principles

- **No single vendor assumes one protocol** — A given product line may offer FHIR, batch export, partner API, or mixed; **capability matrix per product** beats assumptions.
- **Raw + normalized** — Store or reference **raw payload** (or hash + object storage pointer) alongside normalized rows for audits and replays.
- **Tenant mapping layer** — Per-tenant field maps, code set maps (payer IDs, department → place of service), and **validation rules** tuned in onboarding — not global hardcodes.
- **Shadow mode** — Ingest and **score** in parallel with existing billing ops before flipping “staff sees Anang suggestions.”

---

## 4. First integration target: Greenway (research before build)

**Greenway** is called out as the **first real integration target**; **Intergy** may appear in the same enterprise. Important cautions:

- **Multiple products** exist under the Greenway umbrella over time (e.g., different PM/EHR lines). **Do not** code to one API name until **contract + SKU** clarifies which product is in scope.
- **Research tasks (documentation gate before implementation):**
  - Which **product** is licensed (name + major version)?
  - **FHIR / SMART on FHIR** availability, scopes, and BAA path (if any).
  - **Vendor-documented APIs** (REST/SOAP) vs **batch export** (CSV, HL7) for charges and patients.
  - **Claims export** and **remittance** practical path (clearinghouse vs direct).
  - **Sandbox** access, test patient policies, and rate limits.

### 4.1 Public Greenway FHIR documentation (no account required to read)

Greenway publishes a **FHIR R4** program on the [Developer Platform](https://developers.greenwayhealth.com/developer-platform/reference/getting-started-1). Use it as the **baseline** for HTTP shape and auth **before** a tenant-specific endpoint list is in hand.

| Topic | Link | Notes |
|--------|------|--------|
| Getting started | [Getting started](https://developers.greenwayhealth.com/developer-platform/reference/getting-started-1) | FHIR R4 overview, example `curl`/Python |
| SMART apps | [How to Create and Publish SMART-on-FHIR apps](https://developers.greenwayhealth.com/developer-platform/docs/how-to-create-and-publish-smart-on-fhir-apps) | App registration path |
| OAuth | [FHIR Authentication and Authorization](https://developers.greenwayhealth.com/developer-platform/docs/authentication-and-authorization) | Bearer tokens; follow for production/staging |
| Customer base URLs | [FHIR base URLs](https://developers.greenwayhealth.com/developer-platform/page/fhir-base-urls) | **Tenant-specific** endpoints may differ — prefer this list per deployment |
| Developer signup | [Registration](https://devplatform.greenwayhealth.com/developer/registration) | Required to deploy/register apps |

**Documented host pattern (verify against [FHIR base URLs](https://developers.greenwayhealth.com/developer-platform/page/fhir-base-urls) for each customer):**

- **Production-style:** `https://fhir-api.fhirprod.aws.greenwayhealth.com/fhir/R4/{TENANT_ID}`
- **Staging-style:** `https://fhir-api.fhirstaging.aws.greenwayhealth.com/fhir/R4/{TENANT_ID}`

Authenticated requests use `Authorization: Bearer <token>` after OAuth; production access is tied to **Greenway Identity** per their guide. A **public sandbox** was described as coming soon on the getting-started page — plan pilot credentials accordingly.

**Repo:** URL builder, env-backed read helpers, optional **OAuth2 client_credentials** (`GREENWAY_FHIR_CLIENT_ID`, `GREENWAY_FHIR_CLIENT_SECRET`, `GREENWAY_FHIR_TOKEN_URL`, optional `GREENWAY_FHIR_OAUTH_SCOPE`), **FHIR Patient/Encounter normalizers**, and transactional **`syncGreenwayPatientEncounters`** (canonical **`Patient` / `Encounter`** + **`IngestionBatch`** connectorKind **`greenway_fhir`**). **Settings → Implementation hub** — Patient read (see `.env.example`). Cron: **`GET` or `POST` `/api/cron/greenway-fhir-sync`** with **`Authorization: Bearer`** **`CRON_SECRET`**; optional **`?patientId=`** — **probe-only** JSON when **`GREENWAY_FHIR_SYNC_TENANT_SLUG`** is unset, else **upsert** Patient + **`Encounter?patient=`** for that tenant slug when a bearer token is available (**PHI** — BAA staging only).

**Deliverable:** A short **connector brief** (internal memo or appendix in onboarding notes) listing **approved connection path**, **fallback**, and **data element coverage** — signed off by product + engineering before Prisma/adapter specificity.

---

## 5. Fallback import strategy

| Method | When | Guardrails |
|--------|------|------------|
| **CSV importer** | Vendor delay, partial API, historical load | Schema validation, dry-run report, tenant mapping UI |
| **FHIR Bundle upload** | Implementation hub (pilot / validation bundles) | Strict mode, FX toggles — see `docs/DEPLOYMENT.md` |
| **Manual queue** | Exception workflow | Staff UI + audit |

**Idempotent fixture re-import (pilot):** When R4 `Patient.id` / `Encounter.id` are present, **Settings → FHIR import** finds canonical rows via `ExternalIdentifier`, **updates** demographics and visit fields, and **upserts** the id map. Pay: if a statement exists for that encounter with **no posted payments**, lines and balances are **replaced**; if payments exist, a **second statement** (`…-P` suffix) is created so history is preserved. A bundle whose Encounter id already maps to a **different** patient in the tenant is **rejected** with an error (data integrity).

Each import creates a **`SourceArtifact`** row (linked to `IngestionBatch`) with **SHA-256** of the raw bundle text and, when under **`FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES`**, the full JSON for replay. Oversize payloads store fingerprint only until object storage is used (`storageUri`).

All fallbacks should **populate the same canonical entities** so Build / Pay / Insight do not fork.

---

## 6. Mapping into the core data model

1. **Extract** — Connector pulls source record.
2. **Normalize** — Map to Anang types (patient, encounter, line items, financial events).
3. **Key** — Resolve stable internal IDs via external identifier map (idempotency).
4. **Validate** — Tenant rules + global RCM sanity (e.g. DOS present, amounts ≥ 0).
5. **Publish** — Available to modules (Build rules engine reads canonical + raw pointer).

---

## 7. Compliance & operations

- **PHI** only in environments covered by **BAA** and approved retention.
- **Logging** — Correlation IDs, tenant IDs; no raw PHI in application logs (see `docs/PLATFORM_LOGGING.md` if present).
- **Runbooks** — Connector degradation (poll failures, 401 refresh, partial file) with replay and alerting.

---

---

## Appendix A — Greenway & Intergy connector brief (living doc)

**Status:** Synthesis for onboarding and sales engineering — **not** a vendor certification. **Sign off** the “approved path” row per tenant contract before hardening a dedicated adapter name in code.

### A.1 Product landscape (why SKU matters)

| Brand / line (public positioning) | Notes for integration planning |
|-----------------------------------|--------------------------------|
| **Greenway** | Portfolio has evolved through acquisitions; “Greenway” can mean different **practice management / billing** stacks and API programs depending on **contract and product generation**. |
| **Intergy** | Often discussed in the **Greenway / Intergy** enterprise context; treat as a **separate SKU confirmation** — API, batch export, and partner programs may differ from other Greenway-named products. |

**Rule:** The **first integration target** named in §4 is a **commercial and product decision**. Engineering implements against the **documented interface** for the SKU in scope (FHIR app, REST partner API, HL7 v2, scheduled CSV/NCPDP-class exports, clearinghouse-mediated files, etc.).

### A.2 Candidate connection paths (pick one per engagement)

| Path | When to prefer | Risks / prerequisites |
|------|----------------|------------------------|
| **SMART on FHIR / FHIR R4 API** | Vendor offers patient-centric or bulk FHIR with your **registered app**, scopes cover **Patient, Encounter, Coverage**, and (if available) **ChargeItem / Claim** analogs. | OAuth, BAA, rate limits, **incomplete charge** coverage vs PM export. |
| **Vendor REST / SOAP partner API** | Documented developer program; stable **sandbox**; entity coverage matches pilot **Patient + Encounter + financial**. | Version drift; certification timelines. |
| **HL7 v2 (ADT, DFT, BAR)** | Legacy but common; strong for **feeds** when API is weak. | Interface engine, segment mapping, **idempotency** on MRN/visit number. |
| **Batch CSV / fixed-width** | Fastest **pilot rescue**; vendor delivers nightly extracts. | Mapping UI, validation, **manual reconciliation** — use Anang **`csv_upload`** path for rehearsal (Implementation hub). |
| **Clearinghouse / 837-835 loop** | Claim lifecycle already planned under **Connect** — complementary, not a substitute for **demographics + charge** from PM. | Depends on **submission channel**, not always full clinical context. |

**Pilot rehearsal in this repo:** **FHIR Bundle paste** and **CSV v1** populate the same **canonical** `Patient`, `Encounter`, and (with PAY) `Statement` / `StatementLine` rows as vendor paths should eventually do.

### A.3 Data element coverage checklist (minimum viable for Build + Pay rehearsal)

| Domain | Minimum | Stretch |
|--------|---------|---------|
| Patient | MRN, name, DOB | Identifiers, telecom, preferred language |
| Encounter | DOS, department/POS, **link to patient** | External visit id, attending |
| Financial (Pay) | **Line-level** charges: code, description, amount | Diagnosis pointers, modifiers |
| Provenance | Stable **source keys** for idempotent upsert | Raw artifact hash (`SourceArtifact`) |

### A.4 Intergy-specific questions (add answers per RFP)

1. Which **product generation** and **hosting** model (cloud vs hosted) is in contract?
2. Is there a **developer portal** with non-production **credentials** and **test patients**?
3. For **charges**, is the **API** authoritative or is **batch export** the operational source of truth?
4. What is the **supported path** for **remittance** (clearinghouse vs portal CSV)?

### A.5 Sign-off (copy into client folder when filled)

| Field | Owner | Date |
|-------|-------|------|
| SKU in scope | | |
| Approved primary path (from A.2) | | |
| Fallback path | | |
| Sandbox access granted | Y/N | |
| BAA / DPA status | | |

---

## Appendix B — Pharmacy e-claims / NCPDP (optional SKU, E2b2b6)

**Status:** Scaffold only in repo — **no production Teleclaim/SCRIPT parser** until a customer contract explicitly adds pharmacy e-claims beyond **X12 medical** (837P/I professional/institutional).

### B.1 When this appendix applies

| Situation | Action |
|-----------|--------|
| Pilot is **medical professional/institutional only** | Rely on **Connect** X12 path (837/277/835/997); ignore NCPDP scaffolding. |
| Contract includes **retail / mail-order pharmacy** submission or switch files | Open a **product tic** for the exact partner format (ASCII Telecommunication Standard vs batch, version, cert). |

### B.2 Repo scaffolding (today)

| Artifact | Purpose |
|----------|---------|
| `ConnectorKind.ncpdp_pharmacy` | Parallel batch kind for `IngestionBatch` when pharmacy ingest is wired — **reserved** until workers exist. |
| `apps/platform-app/src/lib/connect/ncpdp/ncpdp-claim-hints.ts` | Heuristic `detectNcpdpClaimAsciiHint` for routing/tests — **not** a compliance validator. |
| Env **`NCPDP_CONNECTOR_ENABLED`** | When `1`/`true`/`yes`, **Settings → Integration readiness** and `GET /api/integrations/status` report **test_ready** for the pharmacy lane (ops visibility). |

### B.3 Implementation checklist (when contracted)

1. Obtain **authoritative sample files** (anonymized) + vendor implementation guide version.
2. Map **BIN/PCN/Group** and **claim** segments to canonical **Claim** / timeline (or new pharmacy-specific entities if product requires).
3. Add **webhook or poll worker** with same **`SourceArtifact`** + optional **S3** pattern as X12 (E2b2b5).
4. Add **golden tests** per segment type before enabling tenants.

---

*Document version: 1.5 — connector table: **PriorAuth** staff lane (not ingest); Appendix B NCPDP scaffold (E2b2b6).*

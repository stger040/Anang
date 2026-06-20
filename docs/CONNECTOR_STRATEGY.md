# EHR & Clearinghouse Integration Strategy

**North star:** Anang is a layer on top of existing healthcare infrastructure. We connect to EHRs to read clinical data. We connect to clearinghouses to send claims and receive remittances. We do not replace either.

---

## The Data Flow

```
EHR / PM System
    │  Encounters, Patients, Coverage
    │  (FHIR R4 or CSV)
    ▼
Anang platform-app
    │  Claims AI reviews draft claims
    │  Staff approves
    ▼
Clearinghouse (Availity / Waystar)
    │  837 claim submission
    ▼
Payer (UHC, BCBS, Aetna, etc.)
    │  Adjudicates claim
    │  835 remittance (paid / denied + reason code)
    ▼
Clearinghouse → Anang
    │  Parses 835, records denial reason
    ▼
Claims AI model updates
    (learns which patterns get denied by which payers)
```

The 835 remittance loop is the most important: every denial is a training signal. Over time the model learns what works with each payer.

---

## Three Connector Tiers

### Tier 1 — CSV/XLSX Upload (Day 1, zero IT)

**Use for:** Every pilot, every new client, any EHR without a good API.

Health system exports from their PM system → uploads CSV to Anang → Claims AI runs immediately. No IT involvement. No EHR access required. Gets a pilot live in days.

What to ingest:
- Encounters (visit date, provider, facility, diagnosis codes, procedure codes)
- Patients (demographics, MRN)
- Statements (balance, due date)

**Fallback for anything.** Never block a pilot on connector delays.

### Tier 2 — FHIR R4 Background Sync (Phase 1 automated)

**Use for:** Ongoing automated data sync without requiring EHR access during the clinical workflow.

Uses backend credentials (OAuth2 client_credentials, not SMART launch). Anang polls for new/updated encounters on a schedule.

**FHIR Resources we need:**
- `Patient` — demographics, MRN
- `Encounter` — visit date, provider, facility, type
- `Condition` — diagnoses (ICD-10)
- `Procedure` — procedures (CPT/HCPCS)
- `Coverage` — insurance, payer, member ID
- `ExplanationOfBenefit` — remittance data (if exposed)

**Priority order by market share:**
1. **Epic** (~27% of US hospitals) — Best FHIR R4, sandbox at open.epic.com, App Orchard for distribution. Start here.
2. **athenahealth** (~10%) — Strong FHIR R4, REST webhooks available.
3. **Oracle Health / Cerner** (~8%) — FHIR R4 via Millennium APIs.
4. **Greenway** (~5%) — FHIR R4 at `fhir-api.fhirprod.aws.greenwayhealth.com`. Auth documented at developers.greenwayhealth.com.
5. **eClinicalWorks, Allscripts, etc.** — Evaluate per client.

Implementation pattern:
- `apps/platform-app/src/lib/connectors/<ehr-name>/` — one directory per EHR
- `syncEncounters(tenantSlug, since)` — idempotent upsert via `ExternalIdentifier`
- `IngestionBatch` records every sync run with status, count, errors
- Cron job at `/api/cron/<ehr-name>-sync` with `CRON_SECRET` auth

### Tier 3 — SMART on FHIR (Phase 2, in-workflow)

**Use for:** Claims AI embedded inside the EHR during clinical documentation. Provider types the encounter note → Anang sidebar shows real-time flags.

Requires:
- Epic App Orchard registration (for Epic)
- SMART launch parameters (`launch`, `iss` URL params)
- Scopes: `patient/Encounter.read`, `patient/Condition.read`, `patient/Procedure.read`

This is also the **Epic demo video** — see `docs/ROADMAP.md` Phase 3.

---

## Clearinghouse Strategy

**Do not connect to payers directly.** Connect to one clearinghouse; they handle the payer network.

**Recommended:** Start with **Availity** (largest US clearinghouse network). **Waystar** (acquired Change Healthcare) is the alternative.

What we need from the clearinghouse:
- **837 submission** — Send clean claims outbound
- **277 claim status** — Poll for acceptance/rejection
- **835 ERA** — Receive remittance files (the denial training signal)

The clearinghouse connection is the `CONNECT` module. It's separate from the EHR connectors.

---

## Data Model

Every connector writes to the same canonical models:

| Connector produces | Canonical model |
|-------------------|----------------|
| Patient demographics | `Patient` |
| Visit data | `Encounter` |
| Insurance | `Coverage` |
| Draft claim | `ClaimDraft` → `Claim` |
| Claim submission | `Claim837EdiSubmission` |
| Remittance / denial | `Remittance835` |
| Raw data reference | `IngestionBatch` + `SourceArtifact` (SHA-256 hash) |
| External IDs | `ExternalIdentifier` (idempotency key for upserts) |

**Every import is idempotent.** If the same encounter ID arrives twice, it updates — doesn't duplicate.

---

## Compliance

- All connectors write to PHI-governed environments only (BAA in place).
- Raw FHIR payloads are NOT logged to application logs — only correlation IDs and counts.
- `SourceArtifact` stores SHA-256 of the raw payload for audit; full JSON stored only when under `FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES`.
- FHIR credentials (`CLIENT_ID`, `CLIENT_SECRET`) stored as env vars; never in the database.

---

## Environment Variables (per connector)

```bash
# Epic
EPIC_FHIR_CLIENT_ID=...
EPIC_FHIR_PRIVATE_KEY=...        # RSA private key for JWT auth
EPIC_FHIR_TENANT_FHIR_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4

# Greenway (existing connector)
GREENWAY_FHIR_CLIENT_ID=...
GREENWAY_FHIR_CLIENT_SECRET=...
GREENWAY_FHIR_TOKEN_URL=...
GREENWAY_FHIR_SYNC_TENANT_SLUG=...

# Cron auth (shared)
CRON_SECRET=...

# Clearinghouse
AVAILITY_API_KEY=...
AVAILITY_API_SECRET=...
```

---

## What NOT to Do

- Don't try to build a direct payer connection. Clearinghouse handles this.
- Don't block a pilot on EHR integration. CSV is always available.
- Don't build Greenway-first just because it was the original plan. Epic has 5x the market share.
- Don't store raw FHIR bundles with PHI in application logs.

---

*Last updated: 2026-06-19 — Rewritten around tiered connector approach: CSV → FHIR R4 → SMART on FHIR.*

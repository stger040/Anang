# Import synthetic Excel datasets Prisma/Postgres (Neon or local)

This is **reusable testing infrastructure**: the importer targets a tenant (default **`synthetic-test`**) and is safe to rerun when you follow the flags below.

**Money:** dollar columns in these spreadsheets are treated as **whole USD** integers and stored as **cents** (×100), consistent with the rest of the platform.

---

## What gets imported (summary)

| Source | Sheet(s) | Models |
|--------|----------|--------|
| `claims_data_realistic.xlsx` | `claims_headers` | `Patient`, `Claim`, `ClaimTimelineEvent`, `Statement`, `StatementLine`, `Payment` (partial) |
| `ehr_encounters_realistic.xlsx` | `ehr_encounters` | `Encounter`, `Coverage`, `ExternalIdentifier` |
| `claim_lines_realistic.xlsx` | `claim_lines` | `ClaimDraft`, `ClaimDraftLine` |
| `patient_demographics_realistic.xlsx` | `patient_demographics` | **`Patient`** (upsert-by-link; see demographics mapping) |
| `remittance_adjudication_realistic.xlsx` | `claim_adjudications`, `remittance_lines` | **`Remittance835`**, **`ClaimAdjudication`**, **`RemittanceAdjudicationLine`** |

**Linkage:** Patients from the core three files use `ExternalIdentifier` (`system = synthetic.patient_id`, `value =` spreadsheet `patient_id`). The demographics workbook matches on that key and **updates** the existing `Patient` row.

**Remittance:** Rows link to **`Claim`** via `claimNumber` = spreadsheet `claim_id`. If a claim is missing for that tenant, the adjudication/line row is **skipped** (counted in logs). This is expected if you import remittance before core claims or use a partial extract.

---

## Patient demographics — field mapping

| Spreadsheet column | `Patient` field or storage |
|--------------------|----------------------------|
| `patient_id` | Lookup only — match `ExternalIdentifier.synthetic.patient_id` |
| `mrn` | `mrn` |
| `first_name` | `firstName` |
| `last_name` | `lastName` |
| `date_of_birth` | `dob` (UTC date) |
| `sex` | `sex` |
| `phone` | `phone` |
| `email` | `email` |
| `address_line_1` | `addressLine1` |
| `address_line_2` | `addressLine2` |
| `city` | `city` |
| `state` | `state` |
| `postal_code` | `postalCode` |
| `preferred_language` | `preferredLanguage` |
| `middle_initial`, `marital_status`, `deceased_flag` | **`demographicsExtra` JSON** (not first-class columns) |

**Not modeled as columns:** anything else added to the workbook later will need a doc/code update; extend `demographicsExtra` or add Prisma fields when product requires it.

**Idempotency:** Re-run demographics import **updates** the same patients; it does not create new patients.

---

## Remittance / adjudication — field mapping

### `Remittance835` (header bucket per `remittance_id`)

| Workbook | Field |
|---------|--------|
| `remittance_id` | `remittanceKey` (unique per tenant) |
| `era_trace_number` (from adjudication rows) | `eraTraceNumber` |

`source` is set to `excel_synthetic`. `metadata` is reserved for future use.

### `ClaimAdjudication` (sheet `claim_adjudications`)

| Column | Model field |
|--------|-------------|
| `adjudication_id` | `adjudicationKey` (unique per tenant) |
| `remittance_id` | → `Remittance835` |
| `claim_id` | → `Claim.claimNumber` |
| `encounter_id` | `encounterKey` (string, not FK) |
| `patient_id` | `patientKey` |
| `provider_id` | `providerKey` |
| `payer_name`, `insurance_type` | `payerName`, `insuranceType` |
| `claim_submission_date`, `adjudication_date`, `paid_date` | `claimSubmissionDate`, `adjudicationDate`, `paidDate` |
| `adjudication_phase` | `adjudicationPhase` |
| `claim_status_at_adjudication` | `claimStatusAtAdjudication` |
| `payer_claim_control_number` | `payerClaimControlNumber` |
| `allowed_amount_*`, `paid_amount_*`, `patient_responsibility_amount`, `deductible_amount`, `copay_amount`, `coinsurance_amount`, `adjustment_amount` | `*Cents` |
| `denial_category` | `denialCategory` |
| `finalized_flag`, `appeal_eligible_flag` | `finalizedFlag`, `appealEligibleFlag` (`Yes`/`No` / booleans) |

### `RemittanceAdjudicationLine` (sheet `remittance_lines`)

| Column | Model field |
|--------|-------------|
| `remittance_line_id` | `remittanceLineKey` (unique per tenant) |
| `adjudication_id` | → `ClaimAdjudication` |
| `claim_line_id` | `claimLineKey` (string; not FK to `StatementLine`) |
| `encounter_id`, `patient_id`, `provider_id` | `encounterKey`, `patientKey`, `providerKey` |
| `procedure_code`, `procedure_description` | `procedureCode`, `procedureDescription` |
| Amount columns | `*Cents` |
| `carc_code`, `carc_description`, `rarc_code`, `rarc_description` | same |
| `line_adjudication_status`, `denial_category` | same |

**Intentionally not imported:** raw X12 835 payloads, PLB financials, check/EFT header beyond `eraTraceNumber`, or automatic updates to `Claim.ediRefs` / timeline (product code can join on `payerClaimControlNumber` later).

**Idempotency:** `upsert` on `tenantId` + stable keys (`remittanceKey`, `adjudicationKey`, `remittanceLineKey`). Safe to rerun.

---

## Prerequisites

1. **Migrations applied** (includes `Patient` contact fields + remittance tables):

   ```powershell
   cd c:\Users\stger\Dev\Enterprises\Medtech_placeholder
   npm run db:migrate:deploy:neon
   ```

2. **`DATABASE_URL`** via `apps/platform-app/.env.neon` (Neon) or `.env` (local).

3. Workbooks in **`%USERPROFILE%\Downloads\`** with the expected names (Windows), **or** set env vars (see below).

4. From repo root: `npm install`

---

## Environment variables

| Variable | Default / fallback |
|----------|-------------------|
| `IMPORT_TENANT_SLUG` | `synthetic-test` |
| `REALISTIC_CLAIMS_XLSX` | `%USERPROFILE%\Downloads\claims_data_realistic.xlsx` |
| `REALISTIC_ENCOUNTERS_XLSX` | `ehr_encounters_realistic.xlsx` |
| `REALISTIC_LINES_XLSX` | `claim_lines_realistic.xlsx` |
| `REALISTIC_PATIENT_DEMOGRAPHICS_XLSX` | `patient_demographics_realistic.xlsx` |
| `REALISTIC_REMITTANCE_XLSX` | `remittance_adjudication_realistic.xlsx` |

---

## Commands

### Full replace import (Neon) — wipes **this tenant’s** imported data, then reloads everything

Includes core three workbooks **plus** demographics and remittance when those files exist.

```powershell
cd c:\Users\stger\Dev\Enterprises\Medtech_placeholder\apps\platform-app
npm run db:import:xlsx:neon -- --replace
```

### Enrich-only (Neon) — demographics + remittance upsert **only**

Use when core data is already loaded and you adjusted spreadsheets or need to rerun without wiping patients/claims.

```powershell
cd c:\Users\stger\Dev\Enterprises\Medtech_placeholder\apps\platform-app
npm run db:import:xlsx:enrich:neon
```

Do **not** combine `--enrich-only` with `--replace`.

### Local Postgres

```powershell
cd c:\Users\stger\Dev\Enterprises\Medtech_placeholder\apps\platform-app
npx tsx prisma/import-realistic-xlsx.ts --replace
# or
npx tsx prisma/import-realistic-xlsx.ts --enrich-only
```

---

## What success looks like (console)

After a full run you should see log lines similar to:

- `Creating N patients…`
- `Demographics: updated X patients; skipped Y …`
- `Remittance: claim adjudications upserted A, skipped B …; line rows C, skipped D.`
- `Done. Tenant slug: synthetic-test …`

High **skipped** counts on remittance usually mean claims are not in `Claim` yet (wrong tenant, or import order).

---

## SQL checks (Neon SQL Editor)

Replace slug if needed.

```sql
-- Tenant id
SELECT id, slug FROM "Tenant" WHERE slug = 'synthetic-test';

-- Patients with email populated (after demographics)
SELECT count(*) FROM "Patient" p
JOIN "Tenant" t ON t.id = p."tenantId"
WHERE t.slug = 'synthetic-test' AND p.email IS NOT NULL;

-- Remittance headers
SELECT count(*) FROM "Remittance835" r
JOIN "Tenant" t ON t.id = r."tenantId"
WHERE t.slug = 'synthetic-test';

-- Claim adjudications joined to claim number
SELECT count(*) FROM "ClaimAdjudication" a
JOIN "Tenant" t ON t.id = a."tenantId"
JOIN "Claim" c ON c.id = a."claimId"
WHERE t.slug = 'synthetic-test';

-- Line-level CARC presence
SELECT count(*) FROM "RemittanceAdjudicationLine" l
JOIN "Tenant" t ON t.id = l."tenantId"
WHERE t.slug = 'synthetic-test' AND l."carcCode" IS NOT NULL;
```

---

## `--replace` wipe scope

For the target tenant only, **before** rebuilding core data, the importer deletes (order matters for FKs):

`RemittanceAdjudicationLine` → `ClaimAdjudication` → `Remittance835` → `Claim837EdiSubmission` → timeline → `Claim` → Build drafts/issues → statements → … → `Patient` → `ExternalIdentifier` (and related batches/audit for that tenant).

It does **not** delete the `Tenant` row or other tenants.

---

## Product areas supported by the new data

- **Pay / patient contact:** richer `Patient` rows for statements, outreach, and step-up verification (`phone`, `email`, address, `dob`).
- **Connect / Insight (future UI):** normalized **`ClaimAdjudication`** and **`RemittanceAdjudicationLine`** for ERA-style analytics, denial codes, and paid/adjustment testing without stuffing fake rows into unrelated tables.

---

## Caveats

1. **Demographics rows > core patients:** extra demographic rows with no matching `synthetic.patient_id` are **skipped** (count in log).
2. **Remittance without claim:** rows whose `claim_id` does not match a `Claim` for that tenant are **skipped**.
3. **Not a substitute for production 835 ingestion:** structures are normalized for QA; wire to real EDI parsers separately per `CONNECTOR_STRATEGY.md`.
4. **Patient `sex`:** stored as administrative/EHR-style values from the sheet; not a full identity model.

---

*Schema migration:* `20260330103000_patient_demographics_and_remittance`.

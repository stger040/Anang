# Anang core data model — planning (v1)

**Purpose:** Define the **normalized internal revenue-cycle data model** that ingestion, **Build**, **Connect**, **Insight**, and **Support** share. Anang is **not an EHR**; this model is the **canonical RCM layer** on top of source systems.

**Related:** [`CONNECTOR_STRATEGY.md`](./CONNECTOR_STRATEGY.md) (how data enters), [`MEDICAL_AI_AND_EXPLANATION_LAYER.md`](./MEDICAL_AI_AND_EXPLANATION_LAYER.md) (what must never be “the database is the LLM”).

---

## 1. Architecture goals

| Goal | Implication |
|------|-------------|
| **Multi-tenant isolation** | Every business row is `tenantId`-scoped; cross-tenant analytics only in a controlled warehouse path later. |
| **Raw → canonical → features** | Preserve **source fidelity** (audit, replay) separately from **cleaned** entities staff and modules use. |
| **Connector-agnostic** | Vendor-specific IDs and payloads live in raw/metadata; canonical tables use stable internal keys + optional external identifiers. |
| **Auditability** | Mutations that affect money or compliance leave **AuditEvent** (or successor) + immutable **recommendation / outcome** logs where needed. |
| **Explainability** | Build outputs reference **rule IDs**, **retrieval citations**, or **model version** — not only free text. |
| **Module needs** | Same patient / claim / payment truth; different **views** and **aggregates** for Pay vs Build vs Connect. |

---

## 2. Logical layers (conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│  Raw / landing          │  Source exports, FHIR Bundles,    │
│  (per connector)        │  HL7/EDI artifacts, CSV rows       │
├─────────────────────────┼────────────────────────────────────┤
│  Normalized / canonical │  Patient, Encounter, Claim, Line,  │
│  (tenant truth)         │  Remittance, Denial, Statement…    │
├─────────────────────────┼────────────────────────────────────┤
│  Features / analytics   │  Daily rollups, denial cohorts,    │
│  (Insight + ML inputs)  │  scores, experiment buckets        │
├─────────────────────────┼────────────────────────────────────┤
│  AI / explanation       │  Prompts, retrieved chunks,        │
│  (ephemeral + logged)    │  outputs linked to entity IDs    │
└─────────────────────────┴────────────────────────────────────┘
```

**Rule:** Core billing and denial **decisions** in production should be **explainable without** calling an LLM. LLMs **summarize** and **converse** on top of that truth.

---

## 3. Canonical entities (v1 target set)

Names align with common RCM language; Prisma may diverge slightly until migrations catch up.

### 3.1 Organizations & providers

| Entity | Role | v1 notes |
|--------|------|----------|
| **Tenant / org** | Customer boundary, branding, settings | Exists: `Tenant`. |
| **Facility / location** | Place of service, NPI hierarchy | Often `Organization`/`Location` in FHIR; may start as JSON on Tenant or encounter until modeled. |
| **Provider** | Billing/rendering provider (NPI, taxonomy) | Needed for claim validation; can be normalized from Claim later. |

### 3.2 People & coverage

| Entity | Role | v1 notes |
|--------|------|----------|
| **Patient** | Demographics, MRN, links | Exists: `Patient`. Extend: identifiers map, consent flags. |
| **Coverage / payer plan** | Member ID, group, payer, priority | **`Coverage`** model (tenant + patient); FHIR R4 Coverage ingestion later. |

### 3.3 Clinical & billing units

| Entity | Role | v1 notes |
|--------|------|----------|
| **Encounter / visit** | DOS, department, ties clinical to financial | Exists: `Encounter`. |
| **Charge / service line** | Pre-claim line: CPT/HCPCS, mods, DX pointers, units, charge | Today partially embedded in `ClaimDraftLine`; long-term may be separate from **claim** submission. |
| **Claim** | Institutional/professional header, payer, status | Exists: `Claim`; optional **`encounterId`** and **`claimDraftId`** (nullable FKs) link a submitted claim back to the visit and Build draft for demos and pilot mapping. |
| **Claim line** | Line-level on submitted claim | Distinct from draft lines once 837 / PM export ingestion exists. |

### 3.4 Financial lifecycle

| Entity | Role | v1 notes |
|--------|------|----------|
| **Payment** | Patient / guarantor payment | Exists: `Payment`. |
| **Adjustment** | Contractual, write-off, payer adjustment | Often from 835; new table when EDI lands. |
| **Remittance / ERA** |835 header + claim-level payment | New when Connect deepens. |
| **Denial** | Payer denial with normalized reason code | Normalized **reason** + raw payload; ties to claim/line. |

### 3.5 Patient financial (Pay)

| Entity | Role | v1 notes |
|--------|------|----------|
| **Statement** | Account statement | Exists: `Statement`; optional **`claimId`** and **`encounterId`** tie patient responsibility to the adjudicated claim and visit. |
| **Statement line** | Bill line | Exists: `StatementLine`. |
| **Payment plan / arrangement** | Installments | Future; flags or child of Statement. |

### 3.6 Staff workflows

| Entity | Role | v1 notes |
|--------|------|----------|
| **Work queue item** | Generic task | Map `SupportTask`, Cover cases, future Build queue row to a common pattern or polymorphic type. |
| **Cover assistance case** | Exists: `CoverAssistanceCase`. | |
| **Support task** | Task queue row for billing follow-ups | Exists: `SupportTask`; optional **`statementId`** / **`patientId`**. |

### 3.6b Prior authorization (Connect Phase 1 — shipped)

| Entity | Role | v1 notes |
|--------|------|----------|
| **`PriorAuthCase`** | Staff-owned PA file | Tenant + patient required; optional `encounterId`, `claimId`, `coverageId`; status, urgency, payer fields, SLA timestamps, JSON for payer decision / external refs / rework metrics. Unique `caseNumber` per tenant. |
| **`PriorAuthService`** | Requested procedure rows on a case | CPT/HCPCS-style codes and units (metadata for staff and audits). |
| **`PriorAuthChecklistItem`** | Intake / submission checklist | Per-case rows with status (`PENDING`, `DONE`, `NA`, `BLOCKED`). |
| **`PriorAuthEvent`** | Case timeline | `eventType` + JSON payload + optional `actorUserId` (cron/system events may use null actor with audit). |
| **`PriorAuthAttachment`** | File metadata | Metadata-first; optional `storageUri` when upload path is wired. |
| **`PriorAuthStatusPoll`** | Optional future payer poll log | Placeholder for manual or automated status capture later. |

Tenant **defaults** (which heuristics run, unknown-plan behavior, SLA windows for *staff* queue math) live in **`Tenant.settings.implementation.priorAuth`** — see **`docs/PRIOR_AUTHORIZATION.md`**.

### 3.7 Build-specific (today’s schema)

| Entity | Role | Evolution |
|--------|------|-----------|
| **ClaimDraft** | Pre-submit working claim | Keep; link to **encounter** and eventually to **canonical charge lines**. |
| **ClaimDraftLine** | Draft coding lines | Rules engine outputs attach here or via child `ClaimIssue`-like rows. |
| **ClaimIssue** | Rule / AI finding | `issueSource`, `ruleKey`, **`citations`** (JSON: chunk id + excerpt for retrieval grounding). |
| **BuildKnowledgeChunk** | Tenant-scoped CPT/ICD reference text | Indexed by `(tenantId, kind, lookupKey)`; not payer policy truth. |
| **BuildRulePack** | Per-tenant rule calibration | JSON overrides/disabled keys. |

### 3.8 Audit, recommendations, outcomes

| Entity | Role | v1 notes |
|--------|------|----------|
| **AuditEvent** | Who changed what | Exists: `AuditEvent`. |
| **BuildDraftEvent** | Build draft lifecycle log | `rules_synced`, `draft_approved`; JSON `payload` (counts, rule keys, chunk ids). |
| **Recommendation log** | Broader “suggested action + basis” (future) | May fold more event types when accept/reject UX deepens. |
| **Outcome log** | Accepted / rejected / overridden | Pairs with recommendation; supports shadow mode vs production. |

---

## 4. What each module needs from the model

| Module | Primary reads | Primary writes | Notes |
|--------|---------------|----------------|-------|
| **Build** | Encounter, charges/draft lines, payer + edits, historical denials | Draft lines, issues, recommendation/outcome logs | Must run **with LLMs off** via rules + retrieval scores. |
| **Connect** | Claims, remittances, 277/835-derived status; **PriorAuthCase** (+ children) for Authorizations | Claim lifecycle, timeline events, denial rows; PA case/checklist/event mutations | Exists: `ClaimTimelineEvent`; **PA** tables per §3.6b; expand EDI types as Connect deepens. |
| **Insight** | Aggregates across claims, payments, denials, tasks | Feature tables / MVs (or warehouse) | Avoid heavy analytics on OLTP without rollups. |
| **Pay** | Statement, lines, patient, coverage (for estimates) | Payments, statement status | Explanation uses **codes + amounts**; free text minimized for AI. |
| **Cover** | Coverage, patient, tasks | Case status | Policy content often **retrieval**, not row duplication. |
| **Support** | Statement, lines, tasks, recent payments | Tasks, conversation metadata | Chat logs: retention/redaction policy; link to tenant audit. |

---

## 5. Implement first vs later

### First (foundation)

1. **Tenant-scoped canonical keys** — Ensure every new entity has `tenantId` + indexes consistent with existing patterns.
2. **Encounter ↔ statement ↔ claim** linkage — **Partially shipped:** optional `Claim.encounterId`, `Claim.claimDraftId`, `Statement.claimId`, `Statement.encounterId` in Prisma; ingestion paths should populate when source data allows. Remaining work: broader backfill, EHR-specific provenance fields, and validation rules.
3. **External identifier map** — Small table or JSON: `{ system, value }` per patient/claim (FHIR `Identifier` style) for idempotent upserts.
4. **Recommendation / outcome scaffold** — Even before ML: persist “rule X fired → issue Y” for Build and future Insight.

### Next

5. **Claim line** as first-class (837 / PM export).
6. **Remittance / adjustment / denial** normalized from 835 and payer portals.
7. **Object storage** for `SourceArtifact` when bundle size exceeds inline cap (`storageUri` + replay jobs).

### Later

9. Feature store / warehouse sync for Insight and narrow models.
10. **Cross-facility** hierarchies for large IDNs.

---

## 6. Mapping from current Prisma

Today’s **`apps/platform-app/prisma/schema.prisma`** already includes `Tenant`, `Patient`, `Encounter`, `Coverage`, `ClaimDraft` (+ lines + issues), `Claim`, `Statement` (+ lines), `Payment`, `IngestionBatch`, `SourceArtifact`, `ExternalIdentifier`, **`BuildRulePack`** (per-tenant rule calibration JSON), **`PriorAuthCase`** (+ `PriorAuthService`, `PriorAuthChecklistItem`, `PriorAuthAttachment`, `PriorAuthEvent`, `PriorAuthStatusPoll`), `CoverAssistanceCase`, `SupportTask`, `AuditEvent`.  

**Gap list (engineering backlog):** remittance/adjustment/denial normalization, explicit claim lines for submitted claims, recommendation/outcome tables, provider/facility tables, object storage for **`SourceArtifact`** when payloads exceed inline cap. **Shipped:** `Coverage`, `SourceArtifact` + `IngestionBatch` raw fingerprint / optional inline JSON; **optional thread FKs** on `Claim` / `Statement` (see §5); **staff UI** reads those links on Build / Connect / Pay detail routes when present.

---

*Document version: 1.2 — added §3.6b **PriorAuth\*** (Connect Authorizations Phase 1); schema changes go through Prisma migrations and release notes.*

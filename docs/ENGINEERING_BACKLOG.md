# Engineering backlog — foundational sequence

**Purpose:** Ordered, repo-resident checklist for **long-horizon foundation** work (auditability, core data model, connectors, deterministic Build). Update this file as items ship instead of losing track in chat.

**Planning context:** [`CORE_DATA_MODEL.md`](./CORE_DATA_MODEL.md), [`CONNECTOR_STRATEGY.md`](./CONNECTOR_STRATEGY.md), [`MEDICAL_AI_AND_EXPLANATION_LAYER.md`](./MEDICAL_AI_AND_EXPLANATION_LAYER.md), [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) Part 8.

---

## Tier A — Data & ingest (highest leverage)

- [x] **A1. Prisma: `ExternalIdentifier`, `IngestionBatch`, `Statement.encounterId`, `ClaimIssue.ruleKey` + `issueSource`** — tenant-scoped IDs and audit-friendly issue provenance.
- [x] **A2. FHIR fixture import** — write `IngestionBatch`, optional `ExternalIdentifier` for Patient/Encounter FHIR ids, link `Statement` → `Encounter` when Pay creates a statement.
- [x] **A3. Idempotent re-import** — find-or-create Patient/Encounter by `ExternalIdentifier`; encounter–patient conflict guard; Pay statement **replace lines** when no payments, else **`…-P`** suffix; `ExternalIdentifier` **upsert** updates `resourceId`.
- [x] **A4. `SourceArtifact` / raw payload pointers** — 1:1 with `IngestionBatch`; SHA-256 + optional inline JSON (`FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES`); audit + logs; `storageUri` reserved.
- [x] **A5. Coverage tables** — `Coverage` model + seed (primary/secondary); Pay statement detail lists coverage (not authoritative).

## Tier B — Build (deterministic-first)

- [x] **B1. Rules engine v1** — pure TypeScript evaluation; persists as `ClaimIssue` with `issueSource: RULE` and stable `ruleKey`; sync replaces only RULE rows.
- [x] **B2. Rule packs** — `BuildRulePack` per tenant; JSON (`disabledRuleKeys`, `severityOverrides`, `notes`); Implementation hub form; `sync-draft-rules` applies pack after core rules.
- [x] **B3. Retrieval layer** — `BuildKnowledgeChunk` (CPT/ICD per tenant), `attachRetrievalCitations`, `ClaimIssue.citations` JSON on RULE rows.
- [x] **B4. Recommendation / outcome log** — `BuildDraftEvent` (`rules_synced`, `draft_approved`) + encounter UI activity list.
- [x] **B5. Retrieval curation UI** — Implementation hub: list / add / remove `BuildKnowledgeChunk` per tenant (normalized CPT/ICD keys).

## Tier C — AI explanation (provider-swappable)

- [x] **C1. `BillLineExplanationProvider` abstraction** — template + OpenAI adapters; `bill-line-explain` entrypoint preserved.
- [x] **C2. Azure OpenAI / private endpoint adapter** — `AzureOpenAiBillLineExplanationProvider`, `BILL_EXPLAIN_LLM_PROVIDER` + `AZURE_OPENAI_*`, auto-detect when all Azure vars set.
- [x] **C3. Support assistant** — `SUPPORT_ASSISTANT_TOOL_DEFINITIONS`, `runSupportAssistantTurn`, `POST /api/support/assistant`, Support hub panel (template-only; escalation heuristic).

## Tier D — Connectors

- [x] **D1. Connector kinds + `createIngestionBatch` helper** — typed `ConnectorKind`, central `canonical-ingest.ts`.
- [x] **D2. Greenway / Intergy brief** — `CONNECTOR_STRATEGY.md` Appendix A (SKU/path matrix + sign-off table).
- [x] **D3. CSV importer** — `csv_encounter_statement_v1`, `persistPatientEncounterImport`, Implementation hub + `fixtures/csv/*.example.csv`.
- [x] **D4. Greenway FHIR scaffold** — `src/lib/connectors/greenway-fhir/*`, optional **OAuth2 client_credentials**, Implementation hub **Test Patient read**, secured stub `GET|POST /api/cron/greenway-fhir-sync` (see `CONNECTOR_STRATEGY.md` §4.1, `docs/PILOT_CONNECTOR_ROADMAP.md`).

## Tier E — Connect (product shell)

- [x] **E1. Claims lifecycle UI** — tenant claims list + per-claim timeline from Postgres; EDI identifiers section reserved for clearinghouse integration.
- [x] **E2a. Inbound 277 / 835** — minimal CLP parse, `Claim.ediRefs`, timeline + status updates; `POST /api/webhooks/clearinghouse` + `CLEARINGHOUSE_WEBHOOK_SECRET`.
- [x] **E2b1. Outbound 837 correlation (manual)** — `Claim837EdiSubmission`, Connect claim form (ISA/GS/ST + partner label), timeline + `ediRefs` summary.
- [x] **E2b2a. Inbound EDI audit trail** — clearinghouse webhook writes `IngestionBatch` (`edi_inbound`) + `SourceArtifact`; claims get `lastEdiIngestionBatchId` + `lastInboundTrnRefs` (TRN segments); response includes batch/artifact ids.

### Tier E — Connect: E2b2b (production automation), split

Pick in order unless a pilot contract forces a skip (e.g. partner gives ACK before you generate 837).

- [x] **E2b2b1. Trading partner & enrollment registry** — `Tenant.settings.implementation.tradingPartnerEnrollment` (clearinghouse, environment, ISA/GS codes, enrollment flag, notes); Implementation hub form + Connect summary card.
- [x] **E2b2b2. 837 assembly from canonical** — deterministic map from `Claim` / `ClaimDraft` (+ patient, encounter, coverage) to HIPAA 837P (or I if in scope); output as string or temp file; golden tests from fixtures; **no transport** until **E2b2b3**.
- [x] **E2b2b3. Submit transport + functional ACK (997/999)** — HTTP or SFTP client behind env/feature flag; persist outbound `SourceArtifact`; inbound **997/999** route or reuse clearinghouse webhook with ST detection; match to `Claim837EdiSubmission` / `ediRefs`; timeline events.
- [x] **E2b2b4. X12 validation layer** — structural checks (envelope, segment order/counts, mandatory HIPAA loops for chosen guide); run pre-submit and optionally on inbound before CLP extract; surface errors to tenant admins.
- [x] **E2b2b5. Object storage for EDI blobs** — when payload exceeds inline cap or policy requires WORM/off-DB storage: write `SourceArtifact.storageUri` (e.g. `s3://` / presigned pattern), document env + IAM in `DEPLOYMENT.md`; keep hash on row.
- [x] **E2b2b6. NCPDP / pharmacy (optional SKU)** — parallel `ConnectorKind`, format-hint helper, docs Appendix B, integration status flag; **full parsers/workers contract‑gated** (otherwise medical X12 path only).

## Tier F — Platform / release engineering

- [x] **F1. Prisma Migrate baseline + CI** — `prisma/migrations`, `migration_lock.toml`, `npm run db:migrate:deploy`, GitHub Action `prisma-migrate` on fresh Postgres; deploy/Vercel + Neon docs (`DEPLOYMENT.md`).

## Tier G — Access control (RBAC v1 → v2)

- [x] **G1. Tenant-admin route + nav boundary** — `OrgAccessContext.membershipRole`, `canAccessTenantAdminRoutes`, `/o/.../settings/layout.tsx` redirect for `STAFF`; Admin sidebar item `tenantAdminOnly`. Plan: **[`ACCESS_MODEL.md`](./ACCESS_MODEL.md)**.
- [x] **G2. Staff module caps** — `Membership.staffModuleAllowList` + `UserInvite.staffModuleAllowList`; `computeEffectiveModules`; `requireModuleForSession`; sidebar + staff APIs/actions use **`effectiveModules`**; admin invite/add-member optional checklists. Seed: `support-frontline@lco.anang.demo` (Pay + Cover + Support on LCO).
- [x] **G3. Super-admin `/o` audit trail** — `platformLog` **`platform.super_admin.cross_tenant_workspace`** when super-admin opens `/o/...` without a membership row (`readRequestIdFromHeaders` for correlation).
- [x] **G4. Staff API/action alignment** — Pay (`explain-line`, patient-link, send email/sms, Stripe checkout), Support assistant, Cover/Support/Pay server actions, Connect 837 actions use **`effectiveModules`**; **[`ACCESS_MODEL.md`](./ACCESS_MODEL.md)** §5 documents patient vs public routes. **Ongoing:** review new routes against that section.
- [x] **G5. Patient portal identity + super-admin audit row** — `PatientPortalIdentity` + migrate; **`patient-verify`** upsert; **`emitSuperAdminCrossTenantAccess`** → **`AuditEvent`** + **`platformLog`**; optional **`x-anang-support-context`** (ticket id only).
- [x] **G6. Build server actions** — **`approveClaimDraft`** / **`preview837pFromDraft`** require **`assertOrgAccess`** + **`effectiveModules`** (`BUILD`), not session + slug alone.
- [x] **G7. Tenant admin staff module UI** — **`/o/.../settings/users`**: summary column + per-staff editors; **`updateMembershipStaffModulesAction`** in **`membership-actions.ts`** (`isTenantSettingsEditor` + audit).

## Next build — HIPAA-aligned inference (BAA path)

Use when moving from synthetic/demo data to **client PHI**.

- [x] **H1. Bill-line “Explain charge”** — `INFERENCE_HIPAA_STRICT` + `effectiveBillExplainMinimalPayload()`; `BILL_EXPLAIN_LLM_PROVIDER=azure` documented for BAA path; consumer OpenAI one-time **`pay.bill_explain.hipaa_openai_compliance_reminder`** when strict and not Azure (see `DEPLOYMENT.md`).
- [x] **H2. Support hub assistant** — optional `SUPPORT_ASSISTANT_LLM_ENABLED` + OpenAI with **`redactLikelyIdentifiersForLlm`** when strict; template fallback and escalation heuristic unchanged.
- [x] **H3. Secrets & config** — keys remain server-only; `DEPLOYMENT.md` BAA / `PLATFORM_LOG_WEBHOOK_*` / tenant SMS settings documented.
- [x] **H4. Operational monitoring** — **`platformLog`** duplicate POST to `PLATFORM_LOG_WEBHOOK_URL`; clearinghouse **`connect.edi.inbound_webhook.apply_degraded`** / **`transaction_failed`** for alert routing; bill-explain failures already emit **`pay.bill_explain.openai_*`** (cost caps still an ops/accounting discipline).

---

## How to use

1. Pick the next **unchecked** item in tier order (A → B → C → D → E) unless a pilot **forces** a skip (e.g. Greenway contract).
2. Within **E2b2b1–E2b2b6**, follow **b1 → b6** unless partner access dictates otherwise (e.g. ACK-only pilot → b3 before b2).
3. When an item ships, mark `[x]` and reference the PR or commit range in **`docs/BUILD_SESSION_LOG.md`** if you keep one.

---

## Schema / migrations

**Default:** `npm run db:migrate:deploy -w @anang/platform-app` (CI, Vercel build, and new databases). **`db:push`** remains for emergency drift repair only.

Databases created earlier with **`db:push` only** must run **`prisma migrate resolve --applied 20260329203000_baseline`** once (see **`docs/DEPLOYMENT.md`**).

---

*Last updated: H1–H4 shipped (strict inference, Support LLM option, log webhook, EDI degrade alerts); 835 SVC lines, plan installments ↔ payments, SMS consent/quiet hours, remittance drill-down, PWA icons.*

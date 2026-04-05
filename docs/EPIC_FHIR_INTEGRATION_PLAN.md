# Epic (Tamarack / second pilot) — integration plan (future)

**Purpose:** **Pre-contract engineering plan** for **Epic**-based customers (e.g. **Tamarack Health**) so Wave A (Greenway) work does not paint us into a corner. **No Epic API code ships** in this phase unless/until App Orchard, BAA, and customer-specific endpoints are in hand.

**Companion:** [`PILOT_CONNECTOR_ROADMAP.md`](./PILOT_CONNECTOR_ROADMAP.md) (P1 = Greenway, P2 = Epic).

---

## 1. Why Epic ≠ Greenway in the repo

| Topic | Greenway (P1) | Epic (P2) |
|--------|-----------------|-----------|
| **Developer entry** | Greenway Developer Platform, documented FHIR base host pattern | **Epic on FHIR** + **App Orchard** app lifecycle |
| **Tenant FHIR base** | Customer-specific path under documented AWS hosts | **Organization-specific** FHIR URLs (`metadata` discovery) |
| **Auth** | Greenway Identity + OAuth patterns | SMART on FHIR, client id / certs, often **backend** services after App Orchard approval |
| **Bulk / cohort** | Follow vendor program for search / bulk | **FHIR Bulk Data** may apply for backfill (governance-heavy) |

Reuse **canonical** Anang models (`Patient`, `Encounter`, `ExternalIdentifier`, `IngestionBatch`, `SourceArtifact`) — add an **`epic-fhir/`** connector package **parallel** to `greenway-fhir/`, not a fork of Greenway URLs.

---

## 2. Recommended discovery checklist (before code)

1. **App Orchard** — Non-production app registration, **client id**, redirect / backend service type, required **scopes** (Patient, Encounter, Observation, Coverage, etc. per pilot).
2. **FHIR base URL** — Per environment (sandbox vs prod) from customer Epic team or `metadata`.
3. **BAA / subprocessors** — Anang ↔ health system; inference / logging posture per [`MEDICAL_AI_AND_EXPLANATION_LAYER.md`](./MEDICAL_AI_AND_EXPLANATION_LAYER.md).
4. **Data scope** — Which resources justify **Build** vs **Pay** vs **Connect** for Tamarack phase 1 (avoid boiling the ocean).
5. **Idempotency keys** — Epic logical ids + tenant `ExternalIdentifier` map (same pattern as FHIR import today).

---

## 3. Implementation sketch (when greenlit)

1. **`apps/platform-app/src/lib/connectors/epic-fhir/`** — `env.ts` (org FHIR base, OAuth), `client.ts` (SMART token + GET), optional **Bulk** job runner.
2. **Tenant settings** — Extend `Tenant.settings.implementation` or `connectors.epic` with **non-secret** routing; secrets in env or secret manager keyed by tenant slug.
3. **Workers** — Vercel cron or queue worker: incremental poll vs Bulk snapshot + replay via `IngestionBatch`.
4. **UI** — Implementation hub **connectivity check** mirroring Greenway “test read” pattern.

---

## 4. Until then

- Use **Implementation hub** FHIR bundle + CSV for **Tamarack-shaped** demos.
- Keep **`CONNECTOR_STRATEGY.md`** and **sign-off table** updated when IT answers Appendix A-style questions for Epic.

---

*Document status: planning only — executable Epic connector is **Wave B**.*

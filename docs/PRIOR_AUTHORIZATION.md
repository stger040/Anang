# Prior authorization (medical benefit) — Connect Phase 1

**Purpose:** Single reference for **sales, solutions, and clinical ops** on what Anang ships today for **staff-tracked prior authorization (PA)** on the **medical benefit** side, how it ties to **Build** and **Connect**, and what is **explicitly not** in this phase.

**Technical depth:** Prisma models in `apps/platform-app/prisma/schema.prisma` (`PriorAuthCase` and related tables), domain logic in `apps/platform-app/src/lib/prior-auth/`, staff UI under **`/o/[orgSlug]/connect/authorizations`**.

**Related:** [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) (Connect story) · [`PLATFORM_OVERVIEW.md`](./PLATFORM_OVERVIEW.md) · [`CORE_DATA_MODEL.md`](./CORE_DATA_MODEL.md) · [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md) · [`CLIENT_SHOWCASE.md`](./CLIENT_SHOWCASE.md) · [`DEPLOYMENT.md`](./DEPLOYMENT.md) (cron).

---

## 1. Elevator pitch (for decks and calls)

**Anang helps RCM teams see, queue, and audit prior authorization work** for services that typically need payer approval—**before** you rely on adjudication to tell you something was denied for auth. Staff get a **Connect** workspace (**Authorizations**) with cases, checklists, payer references, SLA-oriented flags, and links back to **patient, encounter, coverage, and claim** when those rows exist. **Build** surfaces **deterministic** “prior auth likely” hints from coded draft lines (imaging bands, infusion, DME, sleep, therapy unit thresholds, etc.) and can **open a prefilled case** from an encounter—**no automatic submission** to payers and **no** payer decision automation in Phase 1.

---

## 2. What ships today (Phase 1)

| Capability | Notes |
|------------|--------|
| **Connect → Authorizations** | Third area under Connect (with claims / remittances): queue, filters (status, payer, dates, overdue / expiring soon), **create case**, **detail** (checklist, service lines, events, links). |
| **Case record** | Status, urgency, priority, payer/plan names, optional auth number and expiration, optional encounter / claim / coverage linkage, JSON slots for payer decision, external refs, rework metrics. |
| **Deterministic “signals” in Build** | Rules classify draft CPT/HCPCS patterns; issues use category **`prior_auth`** so they appear alongside other Build findings. Tenant **Implementation** settings control which **high-risk categories** run and **unknown-plan** behavior (`review_required` vs proceed-low-risk label only—still manual PA). |
| **Create case from encounter** | Staff CTA on **Build → encounter** when **Connect** + **Build** are entitled; prefills patient / coverage / draft lines into the case; **does not** transmit to a payer. |
| **Settings** | **Settings → Implementation hub** includes a **Prior authorization (medical benefit)** block: enable/disable screening, unknown-plan behavior, high-risk category checkboxes, SLA-related numbers (intake hours, standard/expedited SLAs, follow-up interval, “expiring soon” days), rework field keys, optional labor rate (cents/hour). Stored under `Tenant.settings.implementation.priorAuth` (versioned JSON). |
| **Audit & telemetry** | Mutations write **`AuditEvent`** rows and **`platformLog`** lines with tenant, org slug, case id, and linked encounter/claim ids where applicable. |
| **Cron (ops)** | **`GET` or `POST /api/cron/prior-auth-sla-scan`** with **`Authorization: Bearer <CRON_SECRET>`** — scans overdue active cases and approvals nearing expiration; appends case events and logs (deduped within a short window). Optional **Vercel** schedule (add in `vercel.json` when you want it in prod). |
| **API (read + contract)** | **`GET /api/prior-auth/cases?orgSlug=`** and **`GET /api/prior-auth/cases/[caseId]?orgSlug=`** for session-authenticated list/detail; **POST/PATCH** return **501** with typed body stubs for future M2M auth — see `src/lib/prior-auth/prior-auth-api-contract.ts`. |

**Synthetic seed** (`synthetic-test`): includes **four** illustrative PA cases (draft candidate, in review, approved with auth number + expiration, denied with rework-oriented metadata) — see `apps/platform-app/prisma/seed.ts`.

---

## 3. Out of scope for Phase 1 (say this clearly in sales)

| Topic | Posture |
|-------|---------|
| **Pharmacy ePA / NCPDP** | **Not** this feature; pharmacy connector docs remain separate (`CONNECTOR_STRATEGY.md` Appendix B). |
| **Payer portals / vendor SDKs** | No Availity/CoverMyMeds/etc. integration in Phase 1; staff record **submission method** and status manually. |
| **Automated payer decisioning** | No bot that “approves” or “denies”; **`payerDecision`** is staff-entered / imported metadata over time if you add tooling later. |
| **Binary document vault** | **Attachments** are metadata-first (file name, mime, optional URI placeholder); full upload pipeline follows existing object-storage patterns when product prioritizes it. |

---

## 4. Buyer outcomes (honest)

- **Visibility:** One place to see which services may need PA and which cases are stuck, overdue, or expiring.  
- **Accountability:** Checklists + event history + audit events support **internal QA** and payer conversations.  
- **Continuity:** Linking cases to **encounters** and **claims** supports “same episode” narratives in demos and pilots.  
- **Trust:** Deterministic Build rules mean **no black-box** “the AI said get PA” for the shipped heuristics—rule keys and explainability strings are on the issues.

---

## 5. Where to click (pilot demo)

1. **`/o/synthetic-test/connect`** — tabs include **Authorizations**.  
2. **`/o/synthetic-test/connect/authorizations`** — queue + create.  
3. Open a seeded case id from the list (case numbers like **`PA-2026-SEED-0001`** … **`0004`** after fresh seed).  
4. **`/o/synthetic-test/build`** → encounter → note **Prior authorization** card / Build issues if draft lines trigger heuristics.  
5. **`/o/synthetic-test/settings/implementation`** — **Prior authorization** section.

---

## 6. Compliance note (high level)

PA cases can hold **PHI-adjacent** operational metadata (payer names, codes, staff notes). Treat production like the rest of the platform: **BAA**, access controls, and **no PHI in application logs** — follow **`docs/PLATFORM_LOGGING.md`** and `docs/DEPLOYMENT.md`.

---

*Last updated: 2026-04-24 — Connect Phase 1 PA (Authorizations), Build heuristics, implementation settings, cron, seed, API list/detail.*

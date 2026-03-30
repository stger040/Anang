# What we need from you (to keep development moving)

Use this as a working checklist. None of this blocks local coding on the repo; each item **unlocks** the next layer (payments, pilots, compliance).

---

## Now (demo + engineering)

| Item | Why |
|------|-----|
| **Confirm legal entity** | Final `legalName` in `packages/brand/src/config.ts` (e.g. `ExampleCo, LLC`) for contracts and footers later. |
| **Product & AI names (when ready)** | Same file or `docs/BRANDING.md` env vars — suite name, module bullets, voice/chat bot names. |
| **Cloud accounts (your org)** | AWS or Azure account for future staging/prod + **BAA** with the vendor when you host PHI. |
| **Git hosting** | GitHub / Azure DevOps — for CI, backups, and collaboration. |

---

## Before first real patient data

- [ ] **Signed BAAs** with subprocessors you’ll use with PHI (hosting, DB, email/SMS, LLM if patient data hits the model).
- [ ] **Domain strategy** — primary **anang.ai**; later customer vanity domains (e.g. `pay.healthsystem.org`) as needed.
- [ ] **Stripe** (or chosen gateway) **business** account and test keys in `apps/web/.env`.

---

## Before first pilot health system

| Item | Why |
|------|-----|
| **Which EHR** | Epic vs athena vs Oracle Health drives integration order (see `IMPLEMENTATION_PLAN.md`). |
| **Pilot scope** | e.g. Pay + patient portal only vs. + Pre vs. + Claims Build — limits timeline and risk. |
| **Their IT contact** | Sandbox access, VPN, firewall rules, SSO (SAML) requirements. |
| **Clearinghouse** (if claims) | Which vendor and which NPIs/sites — for Connect phase. |
| **Privacy / security** | Someone to answer their infosec questionnaire (use `/api/health`, `/api/version`, subprocessors list). |

---

## Optional but high leverage

- **Designer** — Patient portal and sales deck visual language once names are final.
- **Healthcare counsel** — NSA/transparency, TCPA, state balance-billing rules if you expand modules fast.
- **RCM / coding advisor** — Validates Claims Build rules and denial categories before you sell deeply.

---

## What you do *not* need on day one

- “Open Epic data” or leaked EHR dumps — see `docs/EPIC_AND_TEST_DATA.md`.
- SOC 2 Type II — many pilots start with questionnaire + roadmap.
- Final AI model choice — start with API + RAG; compliance path depends on PHI exposure.

---

When something above is ready, tell your engineering lead **which row** landed (e.g. “Stripe live”, “Epic sandbox creds”) so the next sprint matches `BUILD_PLAN.md` milestones.

# Epic, EHR data, and what to use for testing & training

## Do you need “open source Epic EHR data”?

**There is no legitimate public dump of Epic production data.** Epic is proprietary; real PHI must never be used for training without legal authority. For development:

| Approach | Use for |
|----------|---------|
| **Epic FHIR sandbox (Open Epic)** | Integration testing with Epic-shaped APIs after you [register an app](https://open.epic.com/). R4 resources (Patient, Encounter, Coverage, etc.) — not a full Chronicles clone. |
| **Other vendor FHIR sandboxes** | Cerner code / SMART sandboxes, athena’s developer programs — same idea: contracts + sandboxes, not “open source Epic SQL.” |
| **Synthetic patients** | [Synthea](https://synthetichealth.github.io/synthes/) generates FHIR bundles; good for **volume and pipeline** tests, not payer-specific quirks. |
| **CMS / public datasets** | Fee schedules, ICD/CPT references — good for **knowledge bases and RAG**, not tenant workflows. |
| **Your own fixtures** | JSON FHIR snippets + seeded DB (**`prisma/seed`**) — best for **CI and demos**. |

## Training the AI

- **Patient “explain this charge” assistant:** Mostly **RAG** over CPT/ICD glossaries, plan documents, and **your** approved content — not “training on Epic.”
- **Claims Build copilot:** Combine documentation + **payer policy snippets** (licensed or public) + rules; use **human-in-the-loop** acceptance before any auto-submit (see `BUILD_PLAN.md`).
- **Fine-tuning:** Optional later; still requires **de-identified** or **synthetic** data under a compliance review — not random “Epic exports.”

## Practical order for *this* codebase

1. Keep **SQLite / fixtures** for local dev (current `seed.ts`).
2. Add **FHIR fixture folder** (`apps/web/fixtures/fhir/` or `packages/fixtures/`) with anonymized JSON for tests.
3. When ready, **one** vendor sandbox (Epic *or* athena *or* Cerner) for certification — chosen by first paying pilot, not “all Epic data first.”

## Summary

**You do not need open-source Epic data to build or demo this platform.** You need: synthetic/fixture data now, then **approved sandbox access** for the EHR your customer uses, under **BAAs** and vendor developer agreements.

# Build module — recommended staff workflow

This describes the **intended order of operations** in Build so billing staff can move predictably from “encounter in queue” to “draft reviewed and ready.” It matches the current **claims build** UI (`/o/{org}/build` and encounter detail).

## 1. Open the encounter queue

- Navigate to **Build** (tenant sidebar).
- You see **Build — encounter queue**: one row per encounter with patient, DOS, review status, and draft status.

## 2. Open an encounter workspace

- Click **Review encounter & draft** (or the patient name).
- You land on the **encounter** page: clinical note, patient demographics, draft lines, rule findings, activity, approval, and (when enabled) **Build AI (testing)** controls.

## 3. Read context before changing codes

- Review **Clinical note (seed / EHR)** — chief complaint and visit narrative are primary context for coding.
- Confirm **patient** identity (name, MRN, DOB).

## 4. (Optional, testing mode) Prepare a clean draft for AI

When **Build AI (testing)** is enabled:

- **New blank draft** — creates a new empty draft so this encounter’s *active* draft has no prior lines (useful when imports pre-filled the draft).
- **Clear draft lines (testing)** — removes all lines and rule issues on the **current** draft only (same encounter; keeps one draft record).

Use one of these when you need a visible, AI-driven set of lines rather than imported rows.

## 5. (Optional, testing mode) Run AI code suggestions

- **Suggest draft from encounter** — replaces current draft lines with model-suggested **ICD-10 / CPT / modifiers / units** and narrative rationale; **charges** come from the tenant **synthetic fee schedule**, not from the model.
- Wait for success; refresh if needed. Lines show **AI suggestion** vs **Imported** badges.

## 6. Verify codes and charges (human step)

For each **draft charge line**:

- Read **ICD-10 title** and **CPT / HCPCS title** (assistant + small reference table); use **Look up** links for authoritative check.
- Read **Why suggested (this encounter)** — ties the line to *this* visit.
- Confirm **units**, **modifiers**, and **charge** match policy and fee schedule expectations.

Address **Risk & documentation** issues until your team is satisfied (critical items before approval, per policy).

### Prior authorization (Build + Connect)

- **Deterministic rule issues** may appear with category **`prior_auth`** when tenant **Implementation** prior-auth screening is on (see **`docs/PRIOR_AUTHORIZATION.md`**).
- Open **Connect → Authorizations** to track a case, or use the encounter action to **create a prefilled PA case** (still **manual** with payers in Phase 1).

## 7. Approve when ready

- **Approve claim draft** — marks the draft **ready** and encounter review **approved** (human-only gate; no auto-submission in this path).

## 8. Optional downstream checks

- **Submission-ready claim draft (preview)** — JSON summary.
- **Preview 837P** — structural X12 rehearsal when enabled.

---

## Summary order

1. **Queue** → open encounter  
2. **Understand** note + patient  
3. **(Testing)** Blank draft or clear lines → **Suggest draft** if using AI  
4. **Validate** code titles, rationale, charges, rules  
5. **Approve**  
6. **Preview** export as needed  

---

## Related

- [BUILD_AI_TESTING.md](./BUILD_AI_TESTING.md) — what the model sees, pricing, env, troubleshooting.
- [PRIOR_AUTHORIZATION.md](./PRIOR_AUTHORIZATION.md) — Connect Authorizations + Build PA signals; sales boundaries.
- [LIVE_WEB_APP_CHANGE_CHECKLIST.md](./LIVE_WEB_APP_CHANGE_CHECKLIST.md) — shipping changes to production.

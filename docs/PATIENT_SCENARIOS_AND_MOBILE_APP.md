# Patient scenarios, clinic perspectives, and the future patient app

**Purpose:** Separate **who** each module is for—**patients** vs **clinic staff / operations**—then tie only the **patient-appropriate** pieces to your future **App Store / Google Play** app. Avoid implying that patients “use” back-office RCM tools.

**Related:** [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) (module names and Cedar alignment) · [`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md) (desktop + mobile web + native parity; **success fees** live in **Pay**, not in “app vs browser”).

## What this repo implements today (vs “future patient app”)

Use this section so product and engineering do not confuse **vision** (below and in `PRODUCT_SURFACES_VISION.md`) with **shipped code**.

| Area | Shipped in repo | Not in repo |
|------|-----------------|-------------|
| **Patient Pay (web)** | Public routes under **`/p/[orgSlug]/…`**: org billing landing, **HMAC magic link** to a statement, optional identity step-up, line explain + **Stripe** patient checkout, paid confirmation pages. Staff mint links and optional email/SMS APIs under `apps/platform-app/src/app/api/pay/`. | Dedicated **`apps/patient-portal`** package (`BUILD_PLAN.md` is still a tree sketch). **No** App Store / Play native project (no React Native, Expo, Flutter, etc.). |
| **Staff “patient preview”** | **`/o/{org}/pay/patient-preview`** — authenticated staff demo of patient-facing copy/layout. | Not a separate patient product. |
| **PWA / installable web** | **`/patient-manifest.json`**, `appleWebApp` + manifest in `p/[orgSlug]/layout.tsx`; minimal **`public/patient-sw.js`**; optional **Web Push** subscribe route when `NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED=1` (see `PatientWebPushRegister`, Prisma `PatientPushSubscription`). | Full marketing of a store app; push content policy is still an ops/legal decision. |
| **Cover / Support as patient apps** | **Staff** workflows live under **`/o/…/cover`**, **`/o/…/support`** (authenticated). | **No** public **`/p/…`** Cover intake or patient Help chat matching the future-app table rows below — those rows describe **target** behavior. |
| **Core (patient accounts)** | Workspace **Core** is staff/admin-oriented in this codebase path. | **No** patient self-serve account enrollment under `/p` beyond statement-scoped magic links. |

---

## Who uses which module (quick map)

| Module | Primary audience | Patient app |
|--------|------------------|------------|
| **Pay** (+ Pre) | **Both** — patients pay and read bills; staff configure and reconcile | **Yes** — core of the app |
| **Cover** | **Both** — patients complete intake; **financial counselors** run the process | **Yes** — assisted flows from Pay |
| **Support** | **Both** — patients chat/call; **agents** work queues and copilot | **Yes** — Help tab |
| **Core** | **Both** — patients sign in; **IT/admin** provision tenants and entitlements | **Yes** — settings & identity |
| **Dental** (vertical) | **Both** — same as Pay/Cover, with dental-specific UX | **Yes** — Pay + schedule overlays |
| **Build** | **Clinic staff only** (coding, CDI, RCM analysts) | **No** — no claim drafting or clinical coding UI |
| **Connect** | **Clinic staff only** (billers, denial specialists, clearinghouse ops) | **No module UI** — optional **read-only** billing progress *may* surface inside **Pay** if you publish safe milestones |
| **Insight** | **Clinic staff / leadership only** (dashboards, segmentation) | **No** — segmentation may change *which* pushes patients get, but patients never open “Insight” |

---

## Part 1 — Patient-facing scenarios (what the app is for)

These are the stories **your mobile app** should literally support. Each includes what **staff** do behind the scenes without treating those staff workflows as “patient scenarios.”

---

### Pay (including Pre)

#### Scenario — Before the visit (Pre)

**Patient:** Alex has a visit next week. The hospital’s app sends a push: *“Your estimated responsibility is $180.”* They review a simple breakdown, complete any **estimate acknowledgement** your compliance team requires, optionally leave a **deposit** or card on file, and finish **pre-registration** so the front desk moves faster.

**Clinic (Pay / front desk / finance):** Configure **estimate and deposit** rules, connect **schedule and charge master** feeds, approve **display language**, monitor **who still owes a deposit**, and reconcile payments. Patients never see internal configuration—only the guided experience.

**In the patient app:** **Primary** — home or **“Upcoming care”**: estimates, deposits, reminders.

---

#### Scenario — The bill arrives

**Patient:** After care, Alex opens *“Your statement is ready.”* They see **plain-language lines** (per your content policy), a **short summary of insurance** when you have it, and **one path** to pay in full or enroll in an **approved payment plan**.

**Clinic (Pay):** **Statement and balance** integration from EHR/PM/DMS, **plan templates**, **gateway** settlement, **cash posting** and adjustments—**staff-facing** reconciliation screens in the platform, not shared with patients as “the product.”

**Platform (pilot / rehearsal):** In the tenant **Pay** module, staff can open **Patient experience preview** at `/o/{orgSlug}/pay/patient-preview` — same staff sign-in as today; plain-language balance cards and a path into statement detail for demos. **Patient Pay (web)** is the separate, **no-login** flow: staff **Create patient link** or **Email link** (Resend/SendGrid when configured) → patient opens `/p/{orgSlug}/pay/{token}` and **confirms identity** (date of birth or last four of account/MRN on file) before balances and line detail appear — then **Explain charge** and Stripe checkout (same webhook as staff). Demos can set **`DISABLE_PATIENT_PAY_STEPUP`** to skip the gate (not for production PHI).

**In the patient app:** **Primary** tab — balances, pay, plans, receipts.

---

### Cover

#### Scenario — “I need help affording this”

**Patient:** Sam has a large balance. From the app they tap **coverage or financial assistance**, answer guided questions, **upload documents** if asked, and watch **status** (received, in review, approved, needs more info).

**Clinic (Cover — staff-heavy):** Counselors **manage queues**, run **eligibility and assistance** policies, work vendor or state systems, and **decide outcomes**. When approved, balances and plans update and flow back into **Pay** for Sam to see.

**In the patient app:** **Yes** — **“Coverage & assistance”** entry (often linked from a balance screen). The **work** is counselor-facing; the **form and status** are patient-facing.

---

### Support

#### Scenario — “I don’t understand this bill”

**Patient:** Jordan opens **Help**, chats *“Why is this line $400?”* A **bot** answers within **allowed billing education**; if the thread is account-specific or escalates, a **human** joins with full context.

**Clinic (Support — staff-heavy):** Agents use **queues**, **copilot**, **scripts**, and **Supervisor** views. This module is **operations software**; the patient only sees **chat / callback / phone**.

**In the patient app:** **Yes** — **Help** tab; optional future **voice** channel.

---

#### Scenario — Gentle nudge after an abandoned pay flow

**Patient:** A single push: *“Still want to set up a payment plan?”* with a deep link back to **Pay** or **Help**.

**Clinic (Support + operations):** **Staff** define **rules and caps** (and **Insight** may supply **who** to include—see Part 2). **Support** may handle replies if the patient writes back.

**In the patient app:** **Notifications only** — lands in **Pay** or **Support**, not a separate “module screen.”

---

### Core (patient slice only)

#### Scenario — Getting into the app

**Patient:** Riley downloads the hospital’s app, **verifies identity** (invite, code, portal SSO), enables **Face ID**, picks **notification** preferences, and optionally links **dependents** the hospital allows.

**Clinic (Core — IT / patient access):** **Provision** accounts and **legal** packaging, **branding**, **which guarantor accounts** attach to the login, **audit** of access. This is **admin and integration** work—patients only see onboarding and **Settings**.

**In the patient app:** **Always** — profile, security, legal, linked accounts.

---

### Dental vertical (patient slice)

#### Scenario — Long treatment, monthly payments

**Patient:** A parent sees **ortho phase**, **next adjustment**, and **installment schedule**, and pays the **monthly ortho amount** in the same app.

**Clinic:** Ortho and billing **staff** align DMS contracts to **Pay** plans; **Cover** may still run for hardship.

**In the patient app:** **Yes** — **Pay** surfaces with **dental-specific** layout and copy.

---

## Part 2 — Staff / operations modules (no patient scenario)

These modules are **where hospital employees live all day**. Patients **do not** open them. The only honest patient link is **downstream**: fewer errors, clearer bills, or optional **high-level** status you choose to publish inside **Pay**.

---

### Build (claims intelligence / denial prevention)

**Staff scenario:** Before anything goes to a payer, **Maria (RCM)** opens an **encounter** in **Build**: she reviews **AI-suggested** documentation or code **candidates**, fills **gaps** flagged by the system, checks **prior-auth risk**, and **approves** what the team will submit. Her job is to **prevent denials** and audits—not to talk to patients in this module.

**Why patients matter (indirect):** Cleaner submissions → **fewer “your claim was denied” letters** and **faster fixes** when something still breaks. Patients experience **Pay** and mail from the payer—not **Build**.

**Patient app:** **None.** Do not ship coding, CDI, or draft-review UI to consumers.

---

### Connect (payer rails, remittance, institutional RCM)

**Staff scenario:** **James (billing)** tracks **submissions**, **payer responses**, **835 remittance**, **denials**, and **refiles**. He works **queues** and partner **clearinghouse** tools. Language is **payer codes**, **CARC/RARC**, timelines—**staff vernacular**.

**Optional patient touch (still “Pay,” not “Connect”):** If your product publishes **vetted milestones** (*Submitted → Adjudicated → Your balance updated*), that screen is a **Pay statement detail** backed by **Connect** events. Patients should never see **Connect’s** operational UI.

**Patient app:** **No Connect module.** At most, a **read-only progress strip** on a statement **when data quality supports it**; otherwise omit.

---

### Insight (analytics & orchestration)

**Staff scenario:** **Director-level dashboard**: digital pay rate, Cover funnel, Support SLA, denial rates **after** Build/Connect do their jobs. Analysts build **segments** (e.g. “high balance + no login in 14 days”) that **drive** SMS or push **through Pay/Support**—the patient never sees a chart.

**Patient app:** **None.** Patients may notice **smarter** timing or **less noise**; they do not open “Insight.”

---

## How this maps inside the **patient** app (recommendation)

| Patient sees in the app | Powered by (internal) |
|-------------------------|------------------------|
| Balances, estimates, deposits, pay, plans | **Pay** |
| Assistance / screening / status | **Cover** (patient flow) + staff queues |
| Chat, help, callback | **Support** |
| Login, settings, dependents, legal | **Core** |
| Optional “insurance / billing progress” copy on a statement | **Pay** UI + **Connect** **events** (staff module) |
| Ortho schedule + installments | **Pay** + **Dental** config |
| *(nothing)* | **Build**, **Insight** |

**Native vs web (short):** **Native** = installed **App Store / Play** app (biometrics, wallet, push). **Web** = browser (desktop or mobile), often **first touch** from SMS—no install. Both should call the **same Pay / Cover / Core** APIs over time; **success-fee** economics attach to **Pay**, not the shell—see **[`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md)** for parity vision, desktop vs mobile, and myths about “limited apps.”

**White-label:** **Core** carries **tenant + theme**; patient journeys stay scoped to one hospital’s data.

---

## SMS → web (magic link) → verify → Pay / Cover (reference workflow)

This section captures a **proven pattern** (similar to what many **EHR patient financial** experiences do): **text first**, **link to a hospital-hosted web app**, **no password** until the patient tries something sensitive—then **verify using channels already on file** in the EHR.

### Why this matters for Anang

- **Pay** owns **balance presentment**, **pay-in-full**, **payment plans**, and optional **calming** visual design.
- **Cover** closes the gap you saw elsewhere: same outbound **SMS** and **landing page** should surface **financial assistance** and **coverage / marketplace / Medicaid–Medicare screening** (wording per counsel—not everyone qualifies for Medicare in the “screening” sense; use **precise, approved** language).
- **Core** owns **identity**: **phone** and **email** come from the **registration / patient profile** in the source system; **OTP via SMS or email** proves the person opening the link is tied to that record **before** cards or bank actions.
- **Support** catches people who fail verification or need a human (**HELP** flows can map to your contact center policy).
- **Insight** (staff) later drives **which** segment gets **which** message and **when**—not visible to the patient.

### Two-step SMS cadence (compliance + transactional)

Healthcare and **TCPA** require **consent** and **clear opt-out** for **marketing**; many programs use **separate** transactional and informational tracks—**your counsel** sets the final structure. A pattern that matches what patients often see:

1. **First message (program disclosure)** — Establishes that the patient opted in to **billing / financial** texts from the **named** hospital or clinic, **msg & data rates**, **frequency varies**, **HELP / STOP** instructions.
2. **Later messages (balance events)** — Sent when the **balance changes** or a **statement drops**: facility name, **new balance**, **short list of actions**, single **link**, **STOP** reminder.

**Sender ID:** Short codes (**five-digit** numbers) and **10DLC** long codes each have **carrier registration** and **throughput** rules; typically you buy/program them through an **SMS provider** (e.g. Twilio). That is **infra + legal**, not a module in code—see [`MANUAL_SETUP_CHECKLIST.md`](./MANUAL_SETUP_CHECKLIST.md) §6.

### Example copy skeletons (edit with counsel)

**A — Program / consent (first touch)**

```text
You've signed up to receive billing messages from [Hospital/Clinic Name].
Msg & data rates may apply. Msg frequency varies.
Text HELP for help, STOP to opt out.
```

**B — Balance notification (repeat when balance updates)**

```text
[Hospital/Clinic Name]: You have a new balance of $X,XXX.XX.

Pay, sign up for a payment plan (est. $X/month), apply for financial
assistance, apply for insurance or coverage help (if uninsured or
underinsured), or view details:
[ONE SECURE LINK]

Reply STOP to opt-out.
```

**Module mapping in that one SMS:**

| Line in SMS | Anang module (patient-facing) |
|-------------|-------------------------------|
| Pay | **Pay** |
| Payment plan | **Pay** |
| Financial assistance | **Cover** |
| Insurance / coverage help | **Cover** (marketplace / screening flows as you configure) |
| View details | **Pay** (+ **Cover** entry points on the same landing page) |

### Magic link landing (web) — without full login

**Patient:** Taps link; lands on **hospital-branded web** experience; may see **statement summary** and **calming** layout **before** any password—because the **link is time-limited and tokenized** bound to that account (design with security review).

**Clinic:** Issues links from **Pay** orchestration (and **Insight** rules for timing); logs access in **Core** for audit; revokes or rotates tokens on balance events as needed.

### Verify before money movement (matches Epic-style “text me / email me”)

**Patient:** Taps **Pay in full** or **Start a plan**; next screen: **Verify it’s you** — *Send code to mobile on file* or *Send code to email on file* (numbers/addresses **sourced from EHR / registration**, not re-collected blindly for identity proof).

**Clinic:** **Core** verifies OTP; only then **Pay** hands off to **Stripe** (or your gateway). Failed verification → **Support** path or **call us**.

**In native app:** Same **verify** pattern on first sensitive action if session is stale—or use **biometric session** for repeat visits.

### “Download our app” on the web experience (professional options)

Use a **dismissible banner** or **one card** above the fold—not a blocking pop-up before they see the bill.

**Examples (tune per brand):**

- *“For the full experience—payment plans, financial assistance, coverage help, and secure messaging—download the **[Hospital Name] billing app** for iPhone or Android.”*
- *“You’re on our secure web bill. Our **mobile app** adds features to manage balances, get updates, and chat with support.”* **[Get the app]**

Deep link: **App Store / Play** URLs or **smart link** that detects device. After install, **Core** can **link device** to the same patient via another **lightweight verify** or **SSO**—product decision.

### Where **push** fits (future)

When **native** is installed, **push** replaces some SMS for **authenticated** users (optional: “statement ready,” “plan approved,” “message from billing”). **Policy** (frequency, quiet hours, PHI in payload vs “You have a new message—open app”) is **legal + engineering**; document templates **later** when you ship push—**do not** put detailed PHI in a push **title** on locked phone screens without review.

### Staff-facing summary (SMS + web + app)

| Channel | Pay | Cover | Support | Core |
|---------|-----|-------|---------|------|
| SMS | Balance, plan teaser, link | Assistance & coverage **calls-to-action** in same text | HELP / STOP routing | Consent, STOP audit |
| Web (magic link) | Full pay & plan UX | **Assist** + **insurance** paths **on page** (your differentiator) | Chat link / phone | Token, OTP, session |
| Native app | Same + wallet, biometrics | Same flows, richer uploads | Full **Help** | SSO, device trust |

---

## Summary

- **Patient app = Pay (+ Pre), Cover (intake/status), Support (help), Core (identity), and dental overlays** — period.
- **Build, Connect, and Insight are clinic-staff modules.** **Connect** includes **Authorizations** (prior auth **case tracking** for staff — not a patient self-service surface in Phase 1; see **`docs/PRIOR_AUTHORIZATION.md`**). Patients benefit **indirectly**; **Connect** may **feed** a **Pay** screen only if you intentionally expose safe milestones.
- **Omnichannel:** Many patients **start in SMS → web** (tokenized link, verify-on-pay); **native** adds depth—surface **Cover** in **SMS + web** so you improve on **pay-only** experiences.
- When you ship **v1**, you can still lead with **SMS + web + verify**; **native** follows as the **premium** surface for ongoing management, push (later), and richer **Support**.

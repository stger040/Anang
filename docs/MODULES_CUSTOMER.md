# Customer-facing modules — Cedar-aligned story + Anang depth

**Purpose:** Give sales, founders, and clinicians a **simple module list** that **lines up with Cedar’s familiar names** (Pay, Cover, Support, Pre, dental vertical), while making **Build** (claims / denial prevention) and **Connect** / **Insight** easy to explain. Technical entitlements still use Prisma **`ModuleKey`** — see [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md).

**Principle:** *Same journey-language as Cedar where it helps trust and comparison; same platform — **Build** is our differentiated wedge inside the suite.*

**How staff modules chain (one visit, one financial thread):** **Build** prepares the claim from the **encounter**; **Connect** tracks **submission and adjudication** and (today) **prior authorization case work** under **Authorizations**; **Pay** turns **patient responsibility** into a **statement**; **Support** follows up on balances (often tied to a statement); **Cover** handles affordability programs at **patient** scope. Optional database links and in-app buttons connect **Build ↔ Connect ↔ Pay** when data is populated — Build can also **open a PA case** prefilled from an encounter — see [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md) § *Staff journey & data thread* and **[`PRIOR_AUTHORIZATION.md`](./PRIOR_AUTHORIZATION.md)**.

**Surfaces:** Patient and staff experiences target **desktop web, mobile web, and native apps** over time—same modules; see [`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md).

---

## Are we “aligned” to Cedar?

**Yes, on the patient-financial surface:** our **Pay**, **Cover**, and **Support** names and jobs match how Cedar talks about those products. **Pre** (pre-visit financial engagement) matches Cedar’s pre-service capabilities — we describe it **alongside Pay** so buyers hear one familiar arc.

**We intentionally add three named pillars Cedar does not use the same way:**

| Anang pillar | Role vs Cedar |
|--------------|----------------|
| **Build** | **Claims intelligence** — help staff **prevent denials** and ship cleaner claims *before* payers adjudicate (AI-assisted drafts, documentation gaps, PA awareness, human review). Not a separate Cedar product name in their public suite; it’s **our** clinical/RCM wedge **inside** the same platform as Pay. |
| **Connect** | **Payer & claim operations** — lifecycle, remittance, institutional RCM depth (the “serious RCM” lane). Cedar’s story is more patient-journey-first; we **name** this so hospitals see **837/835-class** commitment, not portal-only billing. |
| **Insight** | **Analytics & improvement** — dashboards, trends, and (over time) experimentation across modules. Often bundled elsewhere in the market; we **surface** it so **analytics tiers** are easy to price. |

**Foundation:** **Core** (tenant admin, identity, entitlements, audit, APIs) is the **platform base** — usually **bundled**, not sold as “a module” in the Cedar style, but required for every deal.

**Dental:** Cedar brands **Cedar Orthodontics** as a **vertical**. We describe **Dental** the same way: **same Pay/Cover/Support/Build/Connect spine**, tuned for **DMS/PMS** (e.g. Dentrix-class) and **dental billing semantics** — see *Dental vertical* below.

---

## Modules in Cedar-style language (what each *will do*)

### Pay

**The bill patients actually understand** — clear digital statements, real-world pay methods (card, ACH, wallets), **payment plans**, and **automated, respectful outreach** (email, SMS, portal) so more balances resolve digitally. Pay combines **billing data** with **coverage context** where you integrate it, so patients see **why** they owe what they owe, not a blind total.

**Pre (with Pay)** — **Before the visit:** estimates and **good-faith estimate**-aware flows (where counsel approves), **pre-registration** hooks, **copay and deposits**, and **reminders** that reduce no-shows and surprise bills. *Cedar often groups this with the suite; we describe it as **part of Pay** so the story stays one easy arc: estimate → visit → statement → pay.*

*Internal keys:* primarily **`PAY`**; pre-service features may stay under Pay routes/settings until you introduce an explicit `PRE` key.

---

### Cover

**Coverage and affordability** — find **insurance and assistance** options for patients who are under-covered or self-pay: **Medicaid, marketplace, pharma or hospital assistance**, screening and **enrollment** assists, renewals. Goal: **less avoidable write-off**, **more third-party coverage**, **less patient hardship** — aligned with **Cedar Cover / Affordability Navigator** positioning.

*Internal key:* **`COVER`**.

---

### Support

**Billing support that scales** — **human agents** plus **AI**: quick answers for routine questions (“balance,” “how to pay”), **escalation** to live staff, **Agent Copilot** for representatives, **proactive outbound** lists prioritized by likelihood to pay, and **digital collection workflows** that tie back to Pay. **Voice** (comparable to **Kora**) sits here as a **channel**, not a separate product name on the price list unless you productize a **voice SKU**.

*Internal key:* **`SUPPORT`**.

---

### Build *(Anang — claims & denial prevention)*

**Stronger claims before they go out the door** — turn encounters and documentation into **cleaner claim drafts** with **AI assistance** and **mandatory human review** where you require it: coding and **documentation gaps**, **payer-rule hints**, **deterministic prior-auth likelihood signals** (imaging, infusion, DME, sleep, therapy thresholds, unknown-plan review) with a **staff path to Connect Authorizations** so you **prevent denials** instead of only chasing them after remittance. **Build works with Pay and Connect:** accurate patient liability supports Pay; clean submission supports Connect; PA cases link back to encounters/claims when staff set them.

*This is the module to point to when a client asks: “How are you not just another billing portal?”*

*Internal key:* **`BUILD`**.

---

### Connect *(Anang — payer rails & lifecycle)*

**From submit to cash** — **claim status**, **remittance**, **denial and refile workflows** on the **payer/operations** side, **clearinghouse-class** depth as you certify partners. Connect is the **institutional** complement to **Cover** (patient-facing affordability help vs **staff-facing** payer work).

**Authorizations (prior authorization — medical benefit, Phase 1)** — staff **queue and case file** for PA: status, payer/plan, checklist, service lines, auth number and expiration when known, optional links to **patient / encounter / coverage / claim**, SLA-style queue flags, and **audit + structured logs**. **Build** raises **rule-based** “prior auth likely” issues on drafts; staff **create cases** from Connect or prefilled from an encounter — **no** automatic payer submission, **no** pharmacy ePA in this slice, **no** automated payer decisioning. Full sales/scope story: **[`PRIOR_AUTHORIZATION.md`](./PRIOR_AUTHORIZATION.md)**.

*Internal key:* **`CONNECT`** (Authorizations lives inside the Connect workspace, not a separate `ModuleKey`).

---

### Insight *(Anang — measurement)*

**See what’s working** — **dashboards**, **KPIs**, **drill-downs**, and over time **experiments** (messaging, timing, channel) and **warehouse exports** so finance and RCM can run the business on facts, not anecdotes.

*Internal key:* **`INSIGHT`**.

---

### Core *(platform foundation)*

**Every customer runs on Core** — organizations, sites, **users and roles**, **SSO**, **white-label**, **entitlements**, **audit**, **integration hooks** (APIs/webhooks). Not usually compared to a Cedar “product” slide, but **required** for every clinic.

*Internal key:* **`CORE`**.

---

### Dental vertical *(Cedar Orthodontics–class)*

**Same platform, dental reality** — workflows for **treatment plans**, longer **installment** patterns, **family/guarantor** billing, **CDT-native** thinking, and **DMS/PMS** integration paths (e.g. **Dentrix-class**). You sell it as a **vertical package** so expectations for **integration and UX** match dental, not acute care.

*Internal key today:* use **`Tenant.settings`** / feature flags for “dental mode” until you add an optional **`DENTAL`** (or similar) **`ModuleKey`*** if you want a hard entitlement line in contracts.

---

## One-page mapping (talk track)

| Say to the buyer (Cedar-familiar) | Anang `ModuleKey` | Notes |
|----------------------------------|-------------------|--------|
| **Pay** (+ **Pre** in the same breath) | `PAY` | Match Cedar Pay + pre-service story. |
| **Cover** | `COVER` | Match Cedar Cover. |
| **Support** | `SUPPORT` | Match Cedar Support + AI/voice. |
| **Build** | `BUILD` | **Our** denial-prevention / claims-intelligence wedge. |
| **Connect** | `CONNECT` | Payer / EDI / lifecycle depth; **Authorizations** = PA case tracking (medical benefit). |
| **Insight** | `INSIGHT` | Analytics module. |
| **Core** | `CORE` | Platform base; usually bundled. |
| **Dental** | settings / future `DENTAL` | Cedar Orthodontics–class vertical. |

---

## Related docs

- [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md) — entitlements, seed tenants, adding clients  
- [`PLATFORM_OVERVIEW.md`](./PLATFORM_OVERVIEW.md) — vision, Cedar comparison at a high level  
- [`PATH_TO_FULL_PRODUCT.md`](./PATH_TO_FULL_PRODUCT.md) — benchmark and build order  
- [`PRIOR_AUTHORIZATION.md`](./PRIOR_AUTHORIZATION.md) — **Connect Authorizations** + Build PA signals; what ships vs out of scope  
- [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md) — patient + clinic scenarios per module; SMS → web → app; future native mapping  
- [`PRODUCT_SURFACES_VISION.md`](./PRODUCT_SURFACES_VISION.md) — build **all** patient shells (desktop web, mobile web, native); how **take-rate** attaches to **Pay**, not to channel  

When **marketing copy** or the **marketing site** lists products, prefer this **Pay • Cover • Support • Pre (with Pay) • Build • Connect • Insight • Dental** ordering so **Build** stays visible as a **first-class bullet**, not a footnote.

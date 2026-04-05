# Product surfaces, commerce, and full parity vision

**Purpose:** Anchor **engineering and product** decisions in one place: **where** patients and staff use Anang (web vs native), **how** success-fee / take-rate economics attach to **payments** (not to a specific shell), and the **north star** of **feature parity** across surfaces once modules are mature.

**Related:** [`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md) · [`MODULES_CUSTOMER.md`](./MODULES_CUSTOMER.md) · [`BUILD_PLAN.md`](../BUILD_PLAN.md)

---

## 1. Vision (north star)

- **One platform, one domain model, many clients:** All **module** capabilities (Pay, Cover, Support, Build, Connect, Insight, Core) expose **consistent APIs and events**. **Patients** and **staff** may use different **shells**, but **business rules** live once.
- **Dental vertical (same shells):** **Dental** does not imply a separate patient app — it is **Cedar Orthodontics–class** packaging on the **same** Pay / Cover / Support surfaces with **dental-specific** layout, copy, and schedules/installments where needed (`MODULES_CUSTOMER.md` § *Dental vertical*; `PATIENT_SCENARIOS_AND_MOBILE_APP.md`).
- **Ship all the ways people work:**
  - **Desktop web** — Staff-heavy (**Build**, **Connect**, **Insight**), long sessions, multi-panel workflows, keyboard power.
  - **Mobile web / PWA** — **SMS magic-link** landing, no install, broad reach; tune for touch.
  - **Native iOS & Android** — **Patient** primary retention: biometrics, wallet (Apple Pay / Google Pay), rich **push** (when counsel approves content), optional offline read of statements.
- **Parity over time:** The **patient** should be able to complete the **same Pay / Cover / Support / Core** journeys on **mobile web** and **native** (differences are *interaction* polish, not *forbidden* capability), except where **regulators, Apple/Google review, or a partner** blocks a flow—in that case document the exception explicitly.
- **Staff** workflows may remain **desktop-first** for years (dual monitors, EDI tooling); still expose **responsive** fallbacks where useful (e.g. supervisor approvals on tablet).

This doc is the **vision contract** for future agents implementing `apps/patient-portal`, native shells, or expanding `apps/platform-app` route groups.

---

## 2. How a “percentage of patient payments” usually works (Cedar-class economics)

Category vendors often report **20–40%** of revenue from **transaction or collection-linked fees**. That is **not** “because the experience is web” or “because it is native.” It is **contract + money movement**:

| Mechanism | What it is |
|-----------|------------|
| **Contract** | MSA / order form says: **X% of dollars** collected **through** the vendor’s rails or **attributed** to their outreach, sometimes with floors/caps. |
| **Attribution** | Ledger + gateway reporting show **which** payments flowed through **Anang Checkout** (or partner MID) vs other channels, so finance can reconcile **success fees**. |
| **Technical locus** | **Pay** module: **hosted checkout**, **plan enrollments**, **webhooks**, **idempotent** payment records—whether the patient tapped **Safari**, **Chrome desktop**, or **native WebView** hitting the **same** payment session API. |
| **Merchant of record** | Sometimes the **health system** is MOR; sometimes a **facilitator** model—**legal and card** counsel decide; implementation still lands in **Pay** + treasury. |

**Implication for builds:** Implement **payment attribution** and **reporting** in the **platform**, not inside a single client. **Web and native** both call the same **Pay** backend so **take-rate** logic stays **one place**.

---

## 3. Web vs native vs desktop — what actually differs

Many consumer apps feel **more limited** than the website because the **vendor chose** to ship a **thin** app (time-to-market, maintenance), **not** because the phone **cannot** do the work.

| Dimension | Desktop web | Mobile web / PWA | Native (iOS / Android) |
|-----------|-------------|------------------|-------------------------|
| **Screen + input** | Best for dense **staff** UIs, spreadsheets, compare-835 side-by-side | Good for **patient** tasks; cramped for **Connect** power work | Great for **focused** patient flows; still tight for multi-window RCM |
| **Install friction** | None | None | **Store listing**, updates, review |
| **Payments** | Full **hosted** fields, 3DS, bank redirect | Same | **Apple Pay / Google Pay** often **smoother** in native |
| **Identity** | Cookies, SSO redirects | Same + magic links | **Biometrics**, secure enclave session |
| **Notifications** | Email, SMS links | SMS links; **limited** web push | **Push** (policy-controlled) |
| **Background / offline** | Weak | Weak (PWA can cache) | Optional **offline statement** read |
| **App store policy** | N/A | N/A | **Review**, IAP rules (usually **not** used for hospital bills—**Stripe**-style pay is typical) |
| **Ship velocity** | One URL | One responsive codebase | Extra **pipeline** per platform |

**Takeaway:** **Desktop web** often wins for **staff complexity**. **Native** often wins for **patient habituation and wallet**. **Mobile web** wins for **first touch** from **SMS**. Anang’s **vision** is to **support all three** for patients; **staff** may prioritize **desktop** first without contradicting the vision.

---

## 4. Capability “limitations” are usually product choices

| Concern | Reality |
|---------|--------|
| “Native can’t do X” | If **X** is **Pay/Cover**, it **can**—use **same APIs**, **WebView** only for odd partner pages if required. |
| “Web can’t take payments” | It **can**—**PCI** via **hosted fields** / **Stripe Checkout** patterns (already directionally in-repo for platform pay experiments). |
| “We can’t clip success fees on native” | **You can**, if the **native** client completes checkout **through your Pay service**—surface is irrelevant to **settlement attribution** design. |
| **HIPAA / logging** | Any surface can leak PHI if mishandled—**Core** auth, **no PHI in push titles**, **BAA’d** analytics—apply **uniformly**. |

Document **real** exceptions (e.g. **state Medicaid** portal must open in **system browser**) in ADRs or module notes—not assumed global limits.

---

## 5. How modules map to surfaces (implementation guide)

| Module | Typical primary surfaces | Parity note |
|--------|---------------------------|-------------|
| **Core** | All | SSO, magic link, OTP, device linking—**all** shells |
| **Pay (+ Pre)** | Mobile web + native + desktop | **Full parity** for patient; treasury views **desktop** |
| **Cover** | Mobile web + native + desktop (intake) | Long forms sometimes easier on **tablet/desktop**; still **mobile-capable** |
| **Support** | All | Chat everywhere; **voice** may be **native + tel** first |
| **Build** | **Desktop** staff | Optional read-only **approve** on tablet later |
| **Connect** | **Desktop** staff | Patient milestones only in **Pay** UI |
| **Insight** | **Desktop** staff | Exports and BI; no patient app |

---

## 6. Repo reality vs this vision (honest)

- **Today:** `apps/platform-app` is largely **tenant/staff** + demo **Pay** routes; **marketing** is separate. **Dedicated patient PWA** and **store-native** apps are **not** the shipped tree yet—`BUILD_PLAN.md` already sketches `apps/patient-portal/`.
- **Direction:** Grow **API-first Pay/Cover/Support/Core** from the same backend, add **patient** route group or **new app** with **shared** `@anang/ui`, then wrap **native** around the same session and checkout endpoints.

When an agent picks up “patient SMS link,” read **[`PATIENT_SCENARIOS_AND_MOBILE_APP.md`](./PATIENT_SCENARIOS_AND_MOBILE_APP.md)**. When an agent picks up “do we need native for take-rate,” point them to **§2** above.

---

## 7. Summary

- **Success fees** attach to **contracts + payment attribution** in **Pay**, not to “web vs app.”
- **Build every surface** the business wants—**desktop web, mobile web, native**—against the **same module APIs**, aiming for **patient journey parity** unless a **documented** exception applies.
- **Native apps** are not inherently weaker; **thin apps** are a **prioritization** choice. Anang’s vision is **not** to stay thin forever on **Pay / Cover / Support**.

# Access model — roles, routes, and modules (v1)

**Purpose:** Single in-repo source of truth for **who may see what** on Anang: patient vs staff vs tenant admin vs platform super-admin, how that maps to **routes** and **`ModuleEntitlement`**, and what remains to harden.

**Related:** [`TENANCY_AND_MODULES.md`](./TENANCY_AND_MODULES.md), [`PLATFORM_OVERVIEW.md`](./PLATFORM_OVERVIEW.md).

---

## 1. Actor categories (product)

| Category | Identity in code (today) | Primary surfaces |
|----------|--------------------------|------------------|
| **Patient** | Not a `User` / `Membership` for Pay flows; **magic-link / token** sessions on **`/p/*`** | Pay, Cover, Support, Core (patient-appropriate copy and data scope only) |
| **Clinic staff** | `User` + `Membership.role === STAFF` | `/o/[orgSlug]/*` operational modules enabled for the tenant |
| **Tenant admin** | `User` + `Membership.role === TENANT_ADMIN` | Staff modules **plus** org **Admin** hub: `/o/[orgSlug]/settings/**` |
| **Platform super-admin** | `User.appRole === SUPER_ADMIN` | `/admin/*` **and** may open any `/o/[orgSlug]` for support (prefer `/admin` for provisioning) |

**Important:** **`ModuleEntitlement` is per tenant, not per user.** A module being “on” for a tenant does **not** mean every staff login may use that module. v1 enforces **tenant-admin-only** **`/settings`**, optional **`staffModuleAllowList`** on **`Membership`** (and **`UserInvite`**) to cap **STAFF** users to a subset of entitled modules, and **`effectiveModules`** (tenant entitlement ∩ allow list) everywhere nav and staff APIs need it.

---

## 2. Prisma reality (`AppRole`, `Membership`)

- **`User.appRole`:** `SUPER_ADMIN` | `TENANT_ADMIN` | `STAFF` — used for **platform-level** super admin; seeded tenant admins typically rely on **`Membership.role`**, not on `User.appRole === TENANT_ADMIN`.
- **`Membership.role`:** `TENANT_ADMIN` | `STAFF` — **tenant-scoped** role for `/o/...` access.
- **`Membership.staffModuleAllowList`:** `ModuleKey[]` — for **STAFF** only. **Empty array** ⇒ may use **all** modules the tenant has enabled. **Non-empty** ⇒ may use only keys in this list (also still must be tenant-entitled). **TENANT_ADMIN** rows should keep the default empty list (ignored).
- **`UserInvite.staffModuleAllowList`:** copied into **`Membership`** when an invite is fulfilled as **STAFF**.
- **Patients:** No `PATIENT` on staff `User` today; Pay uses **tenant + patient bearer / cookie** paths, not NextAuth. **`PatientPortalIdentity`** ties portal activity to **`Patient`** without a shared staff identity table.
- **`PatientPortalIdentity`:** One row per **`Patient`** when they have completed at least one successful **patient-verify**; **`lastSessionVerifiedAt`** updated each time.

**Runtime:** **`OrgAccessContext.effectiveModules`** = `computeEffectiveModules(session, tenantEnabled, membership)` — see `apps/platform-app/src/lib/effective-modules.ts`.

---

## 3. Route separation (non-negotiable product shape)

| Route prefix | Audience | Auth |
|--------------|-----------|------|
| **`/p/*`** | Patients | Link token / verification + gate cookie; **no** staff `User` session |
| **`/o/[orgSlug]/*`** | Staff + tenant admins | NextAuth session; **`assertOrgAccess`** (membership **or** super-admin) |
| **`/o/[orgSlug]/settings/*`** | Tenant admins + super-admins only | Server layout guard + **`canAccessTenantAdminRoutes`** |
| **`/admin/*`** | Platform super-admins | Layout requires `User.appRole === SUPER_ADMIN` |

**UX rule:** Do not blend **internal RCM** affordances (raw CARC/RARC, coding recommendations, operational queues, cross-patient lists) into **`/p/*`**. Patient explanations stay **sanitized** and **scoped to one patient context**.

---

## 4. Module access vs role (v1 rules)

**Tenant entitlements (`ModuleEntitlement`):** Define what the organization has purchased.

**Effective modules (`effectiveModules`):** What this **session** may use in the org: tenant entitlements, then **STAFF** ∩ **`staffModuleAllowList`** when non-empty. **TENANT_ADMIN** and **SUPER_ADMIN** get full tenant entitlements for nav and module routes.

**Role overlays (v1):**

- **Staff (`Membership.STAFF`):** **`effectiveModules`** for sidebar, **`requireModuleForSession`** in each module layout, and staff APIs / actions that check **`ctx.effectiveModules.has(ModuleKey.…)`**. **Must not** open **`/settings`** (redirect; Admin nav hidden).
- **Tenant admin (`Membership.TENANT_ADMIN`):** Full tenant operational modules + **Admin** shell. Settings server actions still use **`enabledModules`** where the question is “does this tenant have the feature,” not “may this user tap it.”
- **Super-admin:** Full tenant entitlements in any org; **`/admin`** remains primary provisioning. **Cross-tenant** `/o` access (**super-admin with no membership row** for that tenant) emits **`platform.super_admin.cross_tenant_workspace`** via **`platformLog`** (see org layout).

**Product naming:** “Billing vs support vs manager” maps to **different allow lists** (or empty = full); no separate Prisma enum required for v1.

---

## 5. API enforcement

**Staff session routes** and **`"use server"` actions** that accept `orgSlug` and touch tenant data should use:

1. **`getSession()`** — 401 if absent.
2. **`assertOrgAccess`** — 403 / null if no tenant access (do **not** trust `orgSlug` alone after only `getSession()`).
3. **`ctx.effectiveModules.has(ModuleKey.…)`** — 403 if this staff identity may not use that module (tenant admin / super-admin get full tenant set). **Build** draft approve / 837 preview actions follow this pattern.

**Settings / implementation** mutations: **`isTenantSettingsEditor`** + tenant **`enabledModules`** where relevant.

**Patient routes** (`patient-verify`, `patient-checkout`, `patient-explain-line`, **web push subscribe**, etc.): **token / Stripe / tenant gate** — not **`effectiveModules`**.

**Public / infra:** **`/api/health`**, **`/api/version`**, **`/api/integrations/status`** — tenant-agnostic; **webhooks** and **cron** use secrets, not staff session.

**Anti-pattern:** Checking only **`enabledModules`** for staff JSON APIs (bypasses **`staffModuleAllowList`**).

---

## 6. Gaps and next implementation steps

**Recently closed:**

- **`/settings`** off-limits to non–tenant-admin staff (layout + nav).
- **Per-staff module caps** via **`staffModuleAllowList`** + **`effectiveModules`** (nav, module layouts, Pay / Support / Cover actions, Pay + Support + Stripe checkout APIs, Connect 837 recording actions).
- **Super-admin cross-tenant** `/o` access when **no `Membership`** row: **`platformLog`** + **`AuditEvent`** (`platform.super_admin.cross_tenant_workspace`); optional **`x-anang-support-context`**.
- **Admin UI:** invite + add-member forms include optional **Staff module access** checklists; audit metadata may include **`staffModuleAllowList`**.
- **Patient portal identity** — **`PatientPortalIdentity`** (1:1 with **`Patient`**) records billing-portal session verification; **not** a staff **`User`**. Upserted on successful **`patient-verify`** (`lastSessionVerifiedAt`). Extensible for future passkeys / OIDC **`sub`** without conflating patients with **`Membership`**.
- **Super-admin DB audit** — cross-tenant **`/o`** access (super-admin **without** membership) writes **`AuditEvent`** (`platform.super_admin.cross_tenant_workspace`) plus **`platformLog`**. Optional request header **`x-anang-support-context`**: ticket / case id only (≤256 chars, **no PHI**).

**Still open (process / future):**

1. **Durable patient login** (passwordless account, passkeys) — build on **`PatientPortalIdentity`**; keep **`/p/*`** separate from staff NextAuth.
2. **Periodic review** — new **`/api/*`** and **server actions** against **`ACCESS_MODEL.md`** §5.

---

## 7. Code pointers

| Concern | Location |
|---------|----------|
| `effectiveModules` + `assertOrgAccess` | `apps/platform-app/src/lib/tenant-context.ts`, **`effective-modules.ts`** |
| Module layouts (session + allow list) | `apps/platform-app/src/lib/module-guard.ts` — **`requireModuleForSession`** |
| Tenant admin route + nav guard | `apps/platform-app/src/lib/tenant-admin-guard.ts` — **`canAccessTenantAdminRoutes`**, **`isTenantSettingsEditor`** |
| Settings layout gate | `apps/platform-app/src/app/(tenant)/o/[orgSlug]/settings/layout.tsx` |
| Sidebar | **`enabledModules` prop** is **effective** module list from org layout |
| Super-admin cross-tenant log | `apps/platform-app/src/app/(tenant)/o/[orgSlug]/layout.tsx` |
| Invite allow list | `apps/platform-app/src/lib/user-invite.ts`, **`UserInvite.staffModuleAllowList`** |
| Tenant admin: edit staff caps | `settings/users` + **`membership-actions.ts`** (`updateMembershipStaffModulesAction`) |
| Form parsing | `apps/platform-app/src/lib/staff-module-form.ts` |
| Patient portal row | `PatientPortalIdentity` — `apps/platform-app/src/app/api/pay/patient-verify/route.ts` |
| Super-admin cross-tenant | `apps/platform-app/src/lib/super-admin-org-audit.ts`; optional header **`x-anang-support-context`** |
| Build server actions | `apps/platform-app/src/app/(tenant)/o/[orgSlug]/build/actions.ts` — **`assertOrgAccess`** + **`BUILD`** on **`effectiveModules`** |

# Role-aware workspace UX

This document describes how the **platform-app** staff shell adapts to **effective modules** (the intersection of tenant entitlements and per-user allow-lists from `computeEffectiveModules` / `assertOrgAccess`). It does **not** change the permissions model — only navigation, first landing, dashboard copy, and cross-module messaging.

## UX model: one operational module

When a user has exactly **one** staff-facing module (Build, Connect, Pay, Support, Cover, or Insight — **CORE** is excluded from this count):

- **Post-sign-in** and deep links that would land on `/o/{slug}/dashboard` instead resolve to that module’s **home path** (e.g. `/o/{slug}/connect`).
- The **sidebar hides** the dashboard / “Start Here” item so the product does not read as a fragment of a larger wizard.
- **Module landing pages** are written to be self-contained: plain-language subtitle, “what this is for”, “what to do today”, top actions, and recent/assigned-style lists.
- **Cross-module** references use **handoff chips** or **action rows**: if the user lacks the target module, copy explains that the step is **handled in** that module (e.g. Pay, Connect) without looking like broken navigation.

## UX model: two or three modules

When the user has **2–3** operational modules and is **not** in full-suite demo mode (see below):

- They still get **`/o/{slug}/dashboard`** as **Home** (not “Start Here”), with a **compact** journey: only their modules, **no** dashed “module not enabled” tiles.
- Sidebar group **“Start”** becomes **“Workspace”** and the home item is labeled **Home** with short help “Your workspace overview”.
- **Stat cards** on Home only emphasize metrics that match their access (placeholders explain where the signal lives when they lack the module).
- **Module pages** keep cross-module chips; inaccessible targets render as **dashed informational pills**, not dead links.

## UX model: full suite / demo

When **`useFullSuiteDashboard`** is true (see `src/lib/adaptive-workspace.ts`):

- **Unlock-all-modules** testing (`ANANG_UNLOCK_ALL_MODULES`), **or**
- **Five or more** operational modules, **or**
- Tenant slug **`synthetic-test`** with **four or more** operational modules,

then:

- Dashboard shows the original **“Start here — staff workflow”** story, **journey tiles** for the full narrative, and **dashed** tiles for tenant modules that are **not** entitled (contract / demo story).
- Sidebar uses **Start Here** and the **Start** group label.
- This preserves the **connected synthetic demo** for broad-access and demo tenants.

## Rationale

1. **Limited-access users** should not infer a mandatory global sequence from UI chrome. Hiding the broad dashboard when it adds no value (single module) and avoiding disabled journey steps (2–3 modules) reduces “missing product” anxiety.
2. **Handoff copy** trains users on **operating model** (“Connect owns payer status”) while respecting **effective modules** — no fake links to routes they cannot use.
3. **Demo / eval tenants** keep a deliberate **multi-module narrative** without forking business rules in the database layer.

## Implementation touchpoints

| Area | Behavior |
|------|-----------|
| `post-signin` / invite | `postSignInTenantPath` → module home if one operational module else dashboard |
| `o/[orgSlug]/layout` | Computes `showDashboardInNav`, dashboard label / short help, passes to shell |
| `app-sidebar` | Omits dashboard when single module; “Workspace” vs “Start” group title |
| `dashboard/page` | Redirect if one module; full vs compact content; stats gated by access |
| Module landing pages | `loadTenantWorkspacePageContext` + `CrossModuleChip` |
| Detail pages (claim, statement, encounter) | `CrossModuleActionRow` for CTAs to other modules |

## Follow-ups (optional)

- Per-role **default tab** inside a module (e.g. Connect → remits vs claims) based on allow-list metadata, if product adds it later.
- **Analytics** on how often single-module users hit dashboard URLs directly (bookmarks) to tune redirects further.

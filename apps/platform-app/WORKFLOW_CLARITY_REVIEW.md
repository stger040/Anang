# Workflow Clarity Review — `apps/platform-app`

## Scope

- Reviewed staff module entry points under `/o/[orgSlug]/*`
- Reviewed sidebar/navigation labels and grouping in `src/components/app-sidebar.tsx`
- Reviewed module landing pages for Build, Connect, Pay, Support, Cover, Insight, and dashboard
- Reviewed cross-module links on encounter, claim, and statement detail pages

## Key Findings

1. **Starting point was unclear for first-time users**
   - Dashboard was KPI-first and did not explicitly coach a live demo narrative.
   - A new user could see metrics, but not know the intended first click.

2. **Module purpose was uneven**
   - Some modules had strong intent copy (Build, Connect), while others felt queue/shell-oriented.
   - “When should I use Cover?” was still easy to misinterpret as generic support.

3. **Navigation was flat and ungrouped**
   - Sidebar listed modules in one sequence without showing journey stages.
   - This made “one platform, many connected modules” feel like separate tools.

4. **Cross-module handoff visibility was improving but inconsistent**
   - Build/Connect/Pay links existed on some detail pages.
   - “Next recommended step” guidance was not consistently present.

5. **Landing pages needed action-oriented onboarding cues**
   - New users needed explicit guidance: what to do here now, and where to go next.

## Recommendations

## P0 (implemented in this pass)

- Add a **Start Here** dashboard narrative that explicitly frames:
  - Build -> Connect -> Pay -> Support/Cover -> Insight
- Add short module framing blocks on each landing page:
  - what this module is for
  - when to use it
  - typical actions
  - next related module
- Group sidebar modules into workflow-aware categories:
  - Start
  - Claims operations
  - Patient financial journey
  - Analytics and admin
- Strengthen “related in other modules” cards and next-step buttons on:
  - Build encounter detail
  - Connect claim timeline
  - Pay statement detail

## P1 (future, not implemented)

- Add a dedicated “demo mode” route preset that opens the seeded patient directly.
- Show lightweight progress indicators (e.g., “Step 2 of 5”) during guided walkthrough.
- Add explicit statement -> support task deep links where data relation exists.

## P2 (future, not implemented)

- Add clearer workflow segmentation in top bar breadcrumbs.
- Add concept glossary tooltips for non-RCM audiences during demos.

## Residual Concept Overlap (current state)

- **Support vs Cover**
  - Support: operational follow-up queue (billing questions, callbacks, task management).
  - Cover: affordability/coverage routing and assistance cases.
  - Still adjacent in real workflows; copy now clarifies that Cover is affordability-specific.

- **Connect vs Insight**
  - Connect: claim-level operational lifecycle.
  - Insight: aggregate KPI summary and performance recap.
  - Overlap remains if users expect deep analytics inside Connect; this is intentional but should remain explicit in copy.

- **Pay vs Support**
  - Pay: statement and payment operations.
  - Support: intervention after unresolved balances/questions.
  - Better guided now via next-step links and module helper text.

## Files Touched for Workflow Clarity

- `src/components/app-sidebar.tsx`
- `src/app/(tenant)/o/[orgSlug]/dashboard/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/build/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/build/encounters/[encounterId]/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/connect/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/connect/claims/[claimId]/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/pay/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/pay/statements/[statementId]/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/support/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/cover/page.tsx`
- `src/app/(tenant)/o/[orgSlug]/insight/page.tsx`

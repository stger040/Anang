# Repository Instructions for AI Coding Agents

**Company:** Anang — https://anang.ai
**Branch:** Always develop on `claude/ecstatic-ramanujan-yo3b5g`

---

## What We Build

**Two products, one platform:**

1. **Claims AI** — Reduces insurance claim denial rates from 40–60% to ~20% over time. AI reviews every claim before submission (deterministic rules → retrieval → ML scores → AI explanation). Also routes and helps resolve denials after the fact. Staff-facing, in `apps/platform-app`.

2. **Patient Pay** — Mobile-first patient billing with an AI agent. Patient gets a magic link, opens it in the Expo app or web, talks to AI to understand their bill, and pays. Patient-facing, in `apps/patient-app` (Expo) + web portal in `apps/platform-app/src/app/p/`.

Read `docs/PLATFORM_OVERVIEW.md` before changing product behavior or adding features.

---

## Apps

| App | Directory | URL | Stack |
|-----|-----------|-----|-------|
| Marketing site | `apps/marketing-site` | anang.ai | Next.js 15, Tailwind |
| Staff platform | `apps/platform-app` | app.anang.ai | Next.js 15, Prisma, Next-Auth |
| Patient mobile app | `apps/patient-app` | iOS/Android deep links | Expo 52, React Native 0.76 |

---

## Staff Workspace Routes (platform-app)

Routes under `apps/platform-app/src/app/(tenant)/o/[orgSlug]/`:

| Route | Module | Purpose |
|-------|--------|---------|
| `build/` | BUILD | Claims AI worklist, encounter review, AI suggestions |
| `pay/` | PAY | Statement management, patient portal links, collections |
| `connect/` | CONNECT | EHR connectors, 837/835, prior auth cases |
| `insight/` | INSIGHT | Analytics, denial trends, AR aging |
| `support/` | SUPPORT | Billing support tasks, escalations |
| `cover/` | COVER | Financial assistance cases, Medicaid screening |
| `settings/` | CORE | Tenant settings, module entitlements, audit |

---

## Patient App Routes (patient-app)

Routes under `apps/patient-app/src/app/`:

| Route | Purpose |
|-------|---------|
| `index.tsx` | Landing: enter token or handle deep link |
| `(tabs)/index.tsx` | My Bill tab — balance, statements |
| `(tabs)/coverage.tsx` | Coverage tab — insurance details |
| `(tabs)/assistance.tsx` | Assistance tab — Medicaid, charity care |
| `(tabs)/account.tsx` | Account tab — settings, sign out |
| `pay/[token].tsx` | Payment screen — Stripe Payment Sheet |
| `pay/plan.tsx` | Payment plan setup |
| `pay/success.tsx` | Payment confirmed |
| `ask-ai.tsx` | AI chat for bill questions |

---

## Key Patterns

### Multi-tenancy
```typescript
import { tenantPrisma } from "@/lib/prisma";
const db = tenantPrisma(orgSlug); // always scope to tenant
```

### Patient auth (mobile)
```typescript
// Verify Bearer token from Authorization header
import { verifyPatientPayToken } from "@/lib/patient-pay-token";
const claims = verifyPatientPayToken(token); // → { orgSlug, statementId } | null
```

### Module entitlement check
```typescript
const tenant = await db.tenant.findUnique({
  where: { slug: orgSlug },
  include: { moduleEntitlements: { where: { module: ModuleKey.PAY, enabled: true } } },
});
if (!tenant || tenant.moduleEntitlements.length === 0) return 403;
```

### Brand strings
Do not hardcode "Anang" in UI. Use `getBrand()` from `@anang/brand` or `packages/brand/src/config.ts`.

---

## Module Keys (Prisma enum)

| Key | Staff product | Patient product |
|-----|---------------|-----------------|
| `CORE` | Always on | Always on |
| `BUILD` | Claims AI pre-denial | — |
| `PAY` | Statement management | Patient Pay mobile + web |
| `CONNECT` | EHR/EDI connectors | — |
| `INSIGHT` | Analytics | — |
| `SUPPORT` | Support task queue | — |
| `COVER` | Financial assistance | Assistance tab |

---

## Patient App API Contract

All routes under `/api/patient/` in platform-app. Auth: `Authorization: Bearer <magic-link-token>`.

See `docs/PATIENT_APP.md` for full API contract.

---

## Do Not

- Hardcode PHI or demo patient data in source files
- Submit claims without staff approval step
- Call LLM APIs with full charge descriptions unless `OPENAI_BILL_EXPLAIN_MINIMAL_PAYLOAD=0`
- Push directly to `main` — always use `claude/ecstatic-ramanujan-yo3b5g`
- Create a PR without the user asking for one

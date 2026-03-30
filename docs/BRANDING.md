# Renaming the company, products, and AI assistants

**Company:** **Anang** ([anang.ai](https://anang.ai)) — defaults in [`packages/brand/src/config.ts`](../packages/brand/src/config.ts). Override with env for pilots without code edits (below).

We **do not** rename `apps/web` or `@platform/web` on every marketing change. Technical paths stay stable; **customer-facing names** are centralized in `@repo/brand`.

## Single file to edit (defaults)

**[`packages/brand/src/config.ts`](../packages/brand/src/config.ts)**

- `company.*` — legal + display name  
- `product.*` — suite name, tagline, patient portal label  
- `modules.*` — Pay, Cover, Support, etc. (like Cedar’s product lines)  
- `ai.*` — patient assistant, voice agent, claims copilot **display names**  
- `technical.serviceId` — string returned by `/api/health` and `/api/version` if infosec wants a specific id  

After editing, restart the Next dev server. Rebuild for production.

## Optional: env overrides (no code change)

Useful for **white-label pilots** or A/B naming without redeploying `config.ts`:

| Variable | Overrides |
|----------|-----------|
| `NEXT_PUBLIC_BRAND_COMPANY_DISPLAY` | `company.displayName` |
| `NEXT_PUBLIC_BRAND_COMPANY_LEGAL` | `company.legalName` |
| `NEXT_PUBLIC_BRAND_SUITE_NAME` | `product.suiteName` |
| `NEXT_PUBLIC_BRAND_TAGLINE` | `product.tagline` |
| `NEXT_PUBLIC_BRAND_DESCRIPTION` | `product.shortDescription` |
| `NEXT_PUBLIC_BRAND_PATIENT_PORTAL_LABEL` | `product.patientPortalBillingLabel` |
| `NEXT_PUBLIC_AI_PATIENT_ASSISTANT_NAME` | patient chat assistant |
| `NEXT_PUBLIC_AI_VOICE_AGENT_NAME` | voice product |
| `NEXT_PUBLIC_AI_CLAIMS_COPILOT_NAME` | Claims Build persona |
| `BRAND_SERVICE_ID` | `technical.serviceId` (server-side) |

Put these in `apps/web/.env` (see `.env.example` additions).

## What you usually do *not* rename

| Item | Why |
|------|-----|
| `apps/web` folder | Wastes git history; meaningless to end users |
| `@platform/web` npm name | Internal workspace package for the Next.js app |
| `modules.*.code` (e.g. `pay`, `cover`) | Stable keys for feature flags, URLs, analytics |
| Prisma model names (`Tenant`, `Statement`) | Domain language, not branding |

## Markdown & legal docs

Plan names in **`IMPLEMENTATION_PLAN.md`** / **`BUILD_PLAN.md`** are descriptive. When you lock a brand, add a **one-line** at the top of those docs: *“Commercial name: X (see packages/brand).”* Optional; not required for the code to run.

## Checklist when the name is final

1. Edit **`packages/brand/src/config.ts`** (and env vars if used).  
2. Update **`README.md`** title if you want the repo intro to match.  
3. Update **marketing site / deck** (out of repo).  
4. Run **`npm run build -w @platform/web`** to verify.  
5. (Optional) Rename root `package.json` `name` field — cosmetic for NPM; safe anytime.

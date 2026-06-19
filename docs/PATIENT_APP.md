# Patient App — Developer Reference

The Anang patient app is a native iOS + Android app built with **Expo 52** and **Expo Router**. It is the patient-facing side of **Patient Pay** — an AI-powered billing experience that helps patients understand and pay their healthcare bills.

**Design target:** Cedar.com's patient financial app. Clean white cards, large balance display, conversational AI, one-tap payment.

---

## Directory

```
apps/patient-app/
  src/
    app/
      _layout.tsx          Root layout with StripeProvider + navigation stack
      index.tsx            Landing screen (token entry + deep link handler)
      (tabs)/
        _layout.tsx        Tab bar (My Bill, Coverage, Assistance, Account)
        index.tsx          My Bill tab
        coverage.tsx       Coverage tab
        assistance.tsx     Assistance tab
        account.tsx        Account tab
      pay/
        [token].tsx        Payment screen (Stripe Payment Sheet)
        plan.tsx           Payment plan setup
        success.tsx        Confirmation screen
      ask-ai.tsx           AI chat screen
    components/
      Card.tsx             Variants: default, navy, sky
      Button.tsx           Variants: primary (coral), secondary, ghost
      Badge.tsx            Variants: success, warning, error, info, neutral
    lib/
      api.ts               API client (SecureStore + Bearer auth)
      theme.ts             Brand color/spacing/typography tokens
```

---

## Environment Variables

```bash
EXPO_PUBLIC_API_URL=https://app.anang.ai          # Platform API base URL
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...    # Stripe publishable key
```

Copy `apps/patient-app/.env.example` to `apps/patient-app/.env`.

---

## Auth Flow

Magic link (no password):

1. Staff (or automated workflow) in platform-app generates a token:
   ```typescript
   import { createPatientPayToken } from "@/lib/patient-pay-token";
   const token = createPatientPayToken({ orgSlug: "riverside", statementId: "stmt_123" });
   ```

2. Token delivered to patient via SMS or email as a deep link:
   ```
   anang-patient://pay?org=riverside&token=<token>
   ```

3. App receives the deep link, stores token + org in `expo-secure-store`:
   ```typescript
   await storeSession(token, orgSlug);
   ```

4. All API calls use `Authorization: Bearer <token>`:
   ```typescript
   // lib/api.ts apiFetch() reads from SecureStore automatically
   const summary = await fetchPatientSummary();
   ```

5. Token verified server-side by `verifyPatientPayToken(token)` → `{ orgSlug, statementId }`.

---

## API Contract

Base URL: `EXPO_PUBLIC_API_URL` (default `https://app.anang.ai`)

All routes require `Authorization: Bearer <magic-link-token>`.

### GET /api/patient/summary

Returns all statements for the patient plus org info.

```json
{
  "orgSlug": "riverside",
  "orgName": "Riverside Health System",
  "totalOwedCents": 84700,
  "statements": [
    {
      "id": "stmt_123",
      "number": "2025-0042",
      "totalCents": 120000,
      "amountDueCents": 84700,
      "dueDateIso": "2025-11-15T00:00:00.000Z",
      "status": "open",
      "paymentPlan": null
    }
  ]
}
```

### GET /api/patient/statement?id=<statementId>

Returns detailed statement. `id` defaults to the statement embedded in the token.

```json
{
  "id": "stmt_123",
  "number": "2025-0042",
  "totalCents": 120000,
  "amountDueCents": 84700,
  "dueDateIso": "2025-11-15T00:00:00.000Z",
  "status": "open",
  "charges": [
    { "id": "line_1", "code": "71046", "description": "Chest X-Ray 2 views", "amountCents": 120000 }
  ],
  "payments": [],
  "paymentPlan": null,
  "coverage": {
    "planName": "Blue Shield PPO",
    "memberId": "BSC123456",
    "groupNumber": "45890",
    "payerName": "Blue Shield of California",
    "effectiveFrom": "2025-01-01T00:00:00.000Z",
    "effectiveTo": "2025-12-31T00:00:00.000Z"
  }
}
```

### POST /api/patient/ask-ai

Body: `{ question: string, lineId?: string }`

```json
{ "answer": "A chest X-ray (code 71046) gives your doctor a two-view image of your lungs and heart. Your insurance paid $35,300 of the $120,000 charge — the $847 you owe is your share after your deductible and coinsurance." }
```

### POST /api/patient/acknowledge-plan

Body: `{ planId: string }`

```json
{ "ok": true }
```

### POST /api/patient/payment-intent

Body: `{ amountCents: number, statementId?: string }`

```json
{ "clientSecret": "pi_3abc...secret_xyz..." }
```

The `clientSecret` is passed to Stripe's `initPaymentSheet()` in the mobile app.

---

## Stripe Payment Flow

1. Patient taps "Pay" on the statement screen
2. `pay/[token].tsx` calls `createPaymentIntentWithToken(token, amountCents)` → gets `clientSecret`
3. `initPaymentSheet({ paymentIntentClientSecret: clientSecret })` called on mount
4. `presentPaymentSheet()` opens Stripe's native modal (card, Apple Pay, Google Pay, ACH)
5. On success → `/pay/success`

Platform-app handles `payment_intent.succeeded` Stripe webhook to mark the statement paid.

---

## Adding a New Screen

1. Create file under `apps/patient-app/src/app/`
2. Add `Stack.Screen` entry to `_layout.tsx` with `headerStyle: { backgroundColor: colors.navy }`
3. Use `apiFetch()` (reads SecureStore token) or `apiFetch(path, init, explicitToken)` for deep-link screens

---

## Running Locally

```bash
cd apps/patient-app
cp .env.example .env           # fill in EXPO_PUBLIC_* vars
npm install
npx expo start                 # scan QR with Expo Go app
npx expo run:ios               # full native build (needed for Stripe, push notifications)
npx expo run:android
```

For Stripe Payment Sheet and push notifications, a full native build (`run:ios` / `run:android`) is required — Expo Go does not support these.

---

## Brand Tokens (lib/theme.ts)

```typescript
colors.navy      = "#13264C"   // primary — headers, nav, pay button
colors.coral     = "#E24E42"   // action — amounts owed, primary CTA
colors.cream     = "#F7F5F2"   // background
colors.sky       = "#E8F4FC"   // light card background
colors.ink       = "#1a1a2e"   // body text
colors.muted     = "#6b7280"   // secondary text
colors.success   = "#10b981"   // paid, confirmed
colors.error     = "#ef4444"   // overdue, error
```

---

*Last updated: 2026-06-19*

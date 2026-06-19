import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://app.anang.ai";

const TOKEN_KEY = "anang_patient_token";
const ORG_KEY = "anang_patient_org";

export async function getStoredToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredOrg(): Promise<string | null> {
  return SecureStore.getItemAsync(ORG_KEY);
}

export async function storeSession(token: string, orgSlug: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(ORG_KEY, orgSlug);
}

export async function clearSession() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ORG_KEY);
}

async function apiFetch<T>(path: string, init?: RequestInit, explicitToken?: string): Promise<T> {
  const token = explicitToken ?? (await getStoredToken());
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type StatementCharge = {
  id: string;
  code: string | null;
  description: string;
  amountCents: number;
};

export type StatementPayment = {
  id: string;
  amountCents: number;
  method: string | null;
  paidAt: string | null;
  status: string;
};

export type PaymentPlan = {
  id: string;
  status: string;
  installmentCount: number;
  intervalWeeks: number;
  perInstallmentCents: number;
};

export type Coverage = {
  planName: string | null;
  memberId: string | null;
  groupNumber: string | null;
  payerName: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type Statement = {
  id: string;
  number: string | null;
  totalCents: number;
  amountDueCents: number;
  dueDateIso: string | null;
  status: string;
  charges: StatementCharge[];
  payments: StatementPayment[];
  paymentPlan: PaymentPlan | null;
  coverage: Coverage | null;
};

export type PatientSummary = {
  orgSlug: string;
  orgName: string;
  totalOwedCents: number;
  statements: Array<{
    id: string;
    number: string | null;
    totalCents: number;
    amountDueCents: number;
    dueDateIso: string | null;
    status: string;
    paymentPlan: PaymentPlan | null;
  }>;
};

export async function fetchPatientSummary(): Promise<PatientSummary> {
  return apiFetch<PatientSummary>("/api/patient/summary");
}

export async function fetchStatement(statementId?: string): Promise<Statement> {
  const qs = statementId ? `?id=${encodeURIComponent(statementId)}` : "";
  return apiFetch<Statement>(`/api/patient/statement${qs}`);
}

/** Used from the pay/[token] deep-link screen where SecureStore may not be set yet. */
export async function fetchStatementWithToken(token: string, statementId?: string): Promise<Statement> {
  const qs = statementId ? `?id=${encodeURIComponent(statementId)}` : "";
  return apiFetch<Statement>(`/api/patient/statement${qs}`, undefined, token);
}

export async function askAiBillQuestion(question: string): Promise<{ answer: string }> {
  return apiFetch<{ answer: string }>("/api/patient/ask-ai", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export async function createPaymentIntent(amountCents: number): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>("/api/patient/payment-intent", {
    method: "POST",
    body: JSON.stringify({ amountCents }),
  });
}

/** Used from the pay/[token] deep-link screen. */
export async function createPaymentIntentWithToken(
  token: string,
  amountCents: number,
): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>(
    "/api/patient/payment-intent",
    { method: "POST", body: JSON.stringify({ amountCents }) },
    token,
  );
}

export async function acknowledgePaymentPlan(planId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/patient/acknowledge-plan", {
    method: "POST",
    body: JSON.stringify({ planId }),
  });
}

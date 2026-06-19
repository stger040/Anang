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

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getStoredToken();
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

export type Statement = {
  id: string;
  totalCents: number;
  amountDueCents: number;
  dueDateIso: string | null;
  status: string;
  charges: Array<{
    id: string;
    description: string;
    cptCode: string | null;
    amountCents: number;
    patientShareCents: number;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    paidAt: string;
  }>;
  paymentPlan: {
    id: string;
    frequencyMonths: number;
    installmentCents: number;
    status: string;
  } | null;
};

export type PatientSummary = {
  orgSlug: string;
  orgName: string;
  statements: Statement[];
  totalOwedCents: number;
};

export async function fetchPatientSummary(
  orgSlug: string,
  token: string
): Promise<PatientSummary> {
  return apiFetch<PatientSummary>(
    `/api/patient/summary?orgSlug=${encodeURIComponent(orgSlug)}&token=${encodeURIComponent(token)}`
  );
}

export async function fetchStatement(
  orgSlug: string,
  token: string
): Promise<Statement> {
  return apiFetch<Statement>(
    `/api/patient/statement?orgSlug=${encodeURIComponent(orgSlug)}&token=${encodeURIComponent(token)}`
  );
}

export async function askAiBillQuestion(
  orgSlug: string,
  token: string,
  question: string
): Promise<{ answer: string }> {
  return apiFetch<{ answer: string }>("/api/patient/ask-ai", {
    method: "POST",
    body: JSON.stringify({ orgSlug, token, question }),
  });
}

export async function createPaymentIntent(
  orgSlug: string,
  token: string,
  amountCents: number
): Promise<{ clientSecret: string }> {
  return apiFetch<{ clientSecret: string }>("/api/patient/payment-intent", {
    method: "POST",
    body: JSON.stringify({ orgSlug, token, amountCents }),
  });
}

export async function acknowledgePaymentPlan(
  orgSlug: string,
  token: string,
  planId: string
): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>("/api/patient/acknowledge-plan", {
    method: "POST",
    body: JSON.stringify({ orgSlug, token, planId }),
  });
}

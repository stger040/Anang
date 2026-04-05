"use client";

import { Button } from "@anang/ui";
import { useState } from "react";

type Props = {
  accessToken: string;
  disabled?: boolean;
};

/** Public patient flow: uses `/api/payments/stripe/patient-checkout` (no staff session). */
export function PatientPayWithStripeButton({ accessToken, disabled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/stripe/patient-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Checkout failed (${res.status})`);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No redirect URL from server");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        className="w-full sm:w-auto min-w-[200px]"
        disabled={disabled || busy}
        onClick={onPay}
      >
        {busy ? "Redirecting…" : "Pay securely"}
      </Button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

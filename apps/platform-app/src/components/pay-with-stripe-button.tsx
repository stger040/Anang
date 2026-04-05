"use client";

import { Button } from "@anang/ui";
import { useState } from "react";

type Props = {
  orgSlug: string;
  statementId: string;
  disabled?: boolean;
};

export function PayWithStripeButton({
  orgSlug,
  statementId,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, statementId }),
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
        size="sm"
        className="w-full"
        disabled={disabled || busy}
        onClick={onPay}
      >
        {busy ? "Redirecting…" : "Pay with Stripe (test)"}
      </Button>
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

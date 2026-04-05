"use client";

import { Button, Card } from "@anang/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Hint = "dob_or_account" | "account_only" | "unavailable";

export function PatientPayVerifyPanel({
  accessToken,
  hint,
  orgDisplayName,
  patientFirstName,
}: {
  accessToken: string;
  hint: Hint;
  orgDisplayName: string;
  patientFirstName: string;
}) {
  const router = useRouter();
  const [dob, setDob] = useState("");
  const [accountLast4, setAccountLast4] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const greeting = patientFirstName.trim() || "there";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (hint === "account_only" && !accountLast4.trim()) {
      setError("Enter the last 4 characters of your account number on file.");
      return;
    }
    if (
      hint === "dob_or_account" &&
      !dob.trim() &&
      !accountLast4.trim()
    ) {
      setError("Enter your date of birth or your account last 4 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pay/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: accessToken,
          ...(hint === "dob_or_account" && dob.trim()
            ? { dob: dob.trim() }
            : {}),
          ...(accountLast4.trim() ? { accountLast4: accountLast4.trim() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not verify. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (hint === "unavailable") {
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-900">
          We can&apos;t verify you online yet
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {orgDisplayName} doesn&apos;t have enough on file to confirm your
          identity automatically. Please call billing for a new link or help
          paying your balance.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mx-auto mt-8 max-w-md p-6 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {orgDisplayName}
      </p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900">
        Confirm it&apos;s you
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Hi {greeting} — before we show statement details, please confirm one of
        the items below matches what {orgDisplayName} has on file.
      </p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        {hint === "dob_or_account" ? (
          <div>
            <label
              className="block text-xs font-medium text-slate-700"
              htmlFor="pp-dob"
            >
              Date of birth
            </label>
            <input
              id="pp-dob"
              name="dob"
              type="date"
              value={dob}
              onChange={(ev) => setDob(ev.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
              autoComplete="bday"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Or use the account number option below instead.
            </p>
          </div>
        ) : null}
        <div>
          <label
            className="block text-xs font-medium text-slate-700"
            htmlFor="pp-last4"
          >
            Last 4 characters of your account / MRN on file
          </label>
          <input
            id="pp-last4"
            name="accountLast4"
            inputMode="text"
            maxLength={16}
            value={accountLast4}
            onChange={(ev) => setAccountLast4(ev.target.value)}
            placeholder="e.g. 4580"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Letters or numbers — match the end of the account number we mailed or
            the ID on your wristband/card.
          </p>
        </div>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          className="w-full"
          disabled={busy}
        >
          {busy ? "Checking…" : "Continue"}
        </Button>
      </form>
    </Card>
  );
}

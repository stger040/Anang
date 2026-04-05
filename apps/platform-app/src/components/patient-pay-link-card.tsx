"use client";

import { Button, Card } from "@anang/ui";
import { useState } from "react";

type Props = {
  orgSlug: string;
  statementId: string;
  balanceCents: number;
};

/**
 * Staff-only UI: mint a signed patient pay URL (magic link), copy, or email.
 */
export function PatientPayLinkCard({
  orgSlug,
  statementId,
  balanceCents,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [smsStatus, setSmsStatus] = useState<string | null>(null);

  async function mint() {
    setError(null);
    setEmailStatus(null);
    setCopied(false);
    setBusy(true);
    try {
      const res = await fetch("/api/pay/patient-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, statementId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        setUrl(null);
        setError(data.error ?? `Could not create link (${res.status})`);
        return;
      }
      setUrl(data.url ?? null);
    } catch {
      setUrl(null);
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy — select the URL manually");
    }
  }

  async function sendSms() {
    setError(null);
    setSmsStatus(null);
    const to = phone.trim();
    if (!to.startsWith("+")) {
      setError("Use E.164 format with country code (e.g. +15551234567).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pay/send-patient-pay-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, statementId, toE164: to }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivery?: string;
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `SMS failed (${res.status})`);
        if (data.url) setUrl(data.url);
        return;
      }
      if (data.url) setUrl(data.url);
      if (data.delivery === "sent") {
        setSmsStatus(`SMS sent to ${to}`);
      } else if (data.delivery === "skipped") {
        setSmsStatus(
          "Twilio not configured — link shown below; copy or email instead (set TWILIO_* env vars).",
        );
      } else {
        setSmsStatus("Done.");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail() {
    setError(null);
    setEmailStatus(null);
    const to = email.trim().toLowerCase();
    if (!to) {
      setError("Enter the patient’s email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/pay/send-patient-pay-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, statementId, toEmail: to }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivery?: string;
        url?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Email failed (${res.status})`);
        if (data.url) setUrl(data.url);
        return;
      }
      if (data.url) setUrl(data.url);
      if (data.delivery === "sent") {
        setEmailStatus(`Email sent to ${to}`);
      } else if (data.delivery === "skipped") {
        setEmailStatus(
          "Email provider not configured — link shown below; copy manually or set RESEND_API_KEY.",
        );
      } else {
        setEmailStatus("Done.");
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  if (balanceCents <= 0) {
    return null;
  }

  return (
    <Card className="border-teal-100 bg-teal-50/50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-900">
        Patient Pay (web)
      </p>
      <p className="mt-2 text-sm text-slate-800">
        Time-limited link: patient verifies identity (DOB or account last four),
        then views the statement, explains charges, and pays with Stripe (same
        webhook as staff checkout). Configure{" "}
        <span className="font-mono text-[11px]">RESEND_API_KEY</span> or{" "}
        <span className="font-mono text-[11px]">SENDGRID_API_KEY</span> to email
        from this form. Optional SMS via Twilio (
        <span className="font-mono text-[11px]">TWILIO_ACCOUNT_SID</span>, etc.).
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={mint}
        >
          {busy ? "Working…" : "Create patient link"}
        </Button>
        {url ? (
          <Button type="button" size="sm" variant="primary" onClick={copy}>
            {copied ? "Copied" : "Copy URL"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-[11px] font-medium text-slate-600" htmlFor="pp-email-recipient">
            Patient email (optional)
          </label>
          <input
            id="pp-email-recipient"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="patient@example.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={sendEmail}
        >
          Email link
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label
            className="text-[11px] font-medium text-slate-600"
            htmlFor="pp-sms-recipient"
          >
            Patient mobile (E.164, optional)
          </label>
          <input
            id="pp-sms-recipient"
            type="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+15551234567"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={sendSms}
        >
          Text link
        </Button>
      </div>
      {url ? (
        <p className="mt-3 break-all rounded-md bg-white/80 p-2 font-mono text-[11px] text-slate-700">
          {url}
        </p>
      ) : null}
      {emailStatus ? (
        <p className="mt-2 text-xs text-teal-900">{emailStatus}</p>
      ) : null}
      {smsStatus ? (
        <p className="mt-2 text-xs text-teal-900">{smsStatus}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

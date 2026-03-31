"use client";

import { Button } from "@anang/ui";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DEMO_TIER_OPTIONS,
  type DemoTierId,
} from "@/lib/demo-tiers";

const CANONICAL_DEMO_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_LOGIN_EMAIL ?? "demo@anang.ai";

export function DemoSignInForm({
  marketingUrl,
  bookMeetingUrl,
}: {
  marketingUrl: string;
  bookMeetingUrl: string;
}) {
  const [email, setEmail] = useState(CANONICAL_DEMO_EMAIL);
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<DemoTierId>("enterprise");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isDemoIdentity = useMemo(() => {
    return (
      email.trim().toLowerCase() === CANONICAL_DEMO_EMAIL.toLowerCase()
    );
  }, [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          demoTier: isDemoIdentity ? tier : undefined,
        }),
      });
      const data = (await res.json()) as {
        redirectTo?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error ?? data.message ?? "Sign-in failed");
        return;
      }
      if (data.redirectTo) {
        window.location.href = data.redirectTo;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
          Choose a demo tier
        </p>
        <p className="text-sm text-slate-600">
          Pick the module mix you want to show. Use the shared demo email and
          password below — no mailbox required.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {DEMO_TIER_OPTIONS.map((t) => {
            const selected = tier === t.id;
            const ring =
              t.accent === "coral"
                ? selected
                  ? "border-brand-coral bg-brand-coral/5 ring-2 ring-brand-coral/40"
                  : "border-slate-200 hover:border-brand-coral/40"
                : selected
                  ? "border-brand-navy bg-brand-sky/40 ring-2 ring-brand-navy/25"
                  : "border-slate-200 hover:border-brand-navy/30";
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTier(t.id);
                  setError(null);
                }}
                className={`rounded-xl border p-4 text-left transition-colors ${ring}`}
              >
                <p className="text-sm font-semibold text-slate-900">
                  {t.title}{" "}
                  <span className="font-normal text-slate-500">
                    · {t.subtitle}
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-600">{t.description}</p>
                <p className="mt-2 text-xs font-medium text-brand-navy">
                  Sample org: {t.tenantPreview}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{t.moduleSummary}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">
          Sign in
        </p>
        <div>
          <label
            htmlFor="demo-email"
            className="block text-xs font-medium text-slate-700"
          >
            Work email
          </label>
          <input
            id="demo-email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            placeholder="demo@anang.ai"
          />
          {isDemoIdentity ? (
            <p className="mt-1 text-xs text-slate-500">
              The selected tier above controls which organization and modules load
              after sign-in.
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-800">
              Using a non-demo email? Tier selection is ignored; password must
              match the demo password configured for this environment.
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="demo-password"
            className="block text-xs font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="demo-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
            placeholder="demo"
          />
          <p className="mt-1 text-xs text-slate-500">
            Default demo password is <code className="font-mono">demo</code>{" "}
            unless your deploy sets{" "}
            <code className="font-mono">DEMO_LOGIN_PASSWORD</code>.
          </p>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </div>

      <p className="text-center text-xs text-slate-500">
        Public site:{" "}
        <Link className="font-medium text-brand-navy underline" href={marketingUrl}>
          {marketingUrl.replace(/^https?:\/\//, "")}
        </Link>
        {" · "}
        <a
          href={bookMeetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-navy underline"
        >
          Book a call
        </a>
      </p>
    </form>
  );
}

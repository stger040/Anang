import Link from "next/link";
import { getBrand } from "@anang/brand";
import { getBookMeetingUrl } from "@anang/config";

export default async function HomePage() {
  const b = getBrand();
  const appUrl = `https://${b.company.platformSubdomain}`;
  const bookUrl = getBookMeetingUrl();

  return (
    <main>
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-brand-navy to-brand-navy-dark text-white">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
            AI Revenue Cycle Platform
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl sm:leading-[1.08] lg:text-6xl">
            Your denial rate is{" "}
            <span className="text-brand-coral">40%.</span>
            <br />
            It should be{" "}
            <span className="text-brand-sky">20%.</span>
            <br />
            We fix it before submission.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">
            {b.company.displayName} catches documentation gaps, missing modifiers,
            and payer-specific denial risks{" "}
            <strong className="text-white">before</strong> the claim leaves your
            system — then helps patients pay what they owe with a modern mobile
            billing experience.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a
              href={bookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-lg bg-brand-coral px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-brand-coral-hover"
            >
              Book a demo
            </a>
            <Link
              href="/pilot"
              className="inline-flex rounded-lg border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              Request a pilot
            </Link>
          </div>
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/5 to-transparent"
        />
      </section>

      {/* ── STAT BAR ── */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <dl className="grid gap-8 sm:grid-cols-3">
            {[
              {
                value: "40–60%",
                label: "Average first-pass denial rate",
                sub: "industry benchmark",
              },
              {
                value: "20–30%",
                label: "Denial rate after Anang Claims AI",
                sub: "early pilot results",
              },
              {
                value: "$262B",
                label: "Lost annually to claim denials",
                sub: "across U.S. health systems",
              },
            ].map((s) => (
              <div key={s.value} className="text-center sm:text-left">
                <dt className="text-3xl font-bold text-brand-navy">{s.value}</dt>
                <dd className="mt-1 text-sm font-medium text-slate-700">
                  {s.label}
                </dd>
                <dd className="text-xs text-slate-400">{s.sub}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── PRODUCTS ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-coral">
          Three products. One platform.
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Everything your RCM team needs to stop losing money
        </h2>

        {/* Claims AI */}
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full bg-brand-sky px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-navy">
              Claims AI
            </span>
            <h3 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              Stop denials before the claim leaves your system
            </h3>
            <p className="mt-4 leading-relaxed text-slate-600">
              Our AI-assisted claims build engine reviews every encounter before
              submission — surfacing missing modifiers, diagnosis specificity
              issues, prior auth requirements, and payer-specific rules your
              billing team might miss.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Deterministic rules engine + payer policy retrieval",
                "Denial risk score per claim (0–100)",
                "Human-in-the-loop: your team approves every change",
                "Integrates with Epic, Greenway Intergy, and other EHRs via FHIR",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
                    ✓
                  </span>
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/platform"
              className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-brand-navy underline-offset-4 hover:underline"
            >
              See how Claims AI works →
            </Link>
          </div>
          {/* Mockup card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Claims Build · Encounter #4821
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    Maria Santos · Blue Cross PPO
                  </p>
                </div>
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                  73% denial risk
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                {[
                  {
                    type: "RULE",
                    msg: "Missing modifier 25 — E&M + procedure same date requires modifier 25 for this payer",
                    action: "Add modifier 25",
                  },
                  {
                    type: "PAYER",
                    msg: "Diagnosis Z87.891 too nonspecific — Blue Cross requires 4th digit for outpatient claims",
                    action: "Suggest Z87.39",
                  },
                  {
                    type: "AUTH",
                    msg: "CPT 27447 likely requires prior authorization — payer policy updated Jan 2025",
                    action: "Flag for PA",
                  },
                ].map((issue) => (
                  <li
                    key={issue.msg}
                    className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">
                          {issue.type}
                        </span>
                        <p className="mt-0.5 text-xs text-slate-700">
                          {issue.msg}
                        </p>
                      </div>
                      <button className="shrink-0 rounded-md bg-brand-navy px-2.5 py-1 text-[11px] font-semibold text-white">
                        {issue.action}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Patient Pay */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          {/* Mobile mockup */}
          <div className="order-2 lg:order-1 flex justify-center">
            <div className="w-64 rounded-[2rem] border-4 border-slate-800 bg-white shadow-2xl overflow-hidden">
              {/* Status bar */}
              <div className="bg-white px-5 pt-3 pb-1 flex justify-between text-[10px] text-slate-800 font-medium">
                <span>9:41</span>
                <span>▪▪▪ ▪ ▪▪▪</span>
              </div>
              {/* App header */}
              <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-brand-navy" />
                  <span className="text-xs font-bold text-brand-navy">Riverside Health</span>
                </div>
                <div className="h-5 w-5 rounded-full bg-brand-sky flex items-center justify-center">
                  <span className="text-[8px] text-brand-navy">💬</span>
                </div>
              </div>
              {/* Balance card */}
              <div className="bg-brand-navy mx-3 mt-3 rounded-xl p-4 text-white">
                <p className="text-[10px] text-white/60">Balance due</p>
                <p className="text-2xl font-bold mt-0.5">$847.00</p>
                <p className="text-[10px] text-white/60 mt-1">Due Nov 15, 2025</p>
                <button className="mt-3 w-full rounded-lg bg-brand-coral py-2 text-xs font-bold text-white">
                  Pay Now
                </button>
              </div>
              {/* Explanation */}
              <div className="mx-3 mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px]">✦</span>
                  <span className="text-[10px] font-bold text-brand-navy">Ask AI</span>
                  <span className="rounded-full bg-brand-sky px-1.5 py-0.5 text-[8px] text-brand-navy">Why do I owe this?</span>
                </div>
                <p className="text-[10px] text-slate-600 leading-relaxed">
                  Your $847 balance is for your knee MRI on Oct 12. Your insurer covered 80% — this is your 20% coinsurance after your deductible.
                </p>
              </div>
              {/* Plan option */}
              <div className="mx-3 mt-3 mb-4 rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-bold text-slate-900">Payment plan</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Customize anytime · no interest</p>
                <div className="mt-2 flex gap-1">
                  <button className="flex-1 rounded-lg bg-brand-navy py-1.5 text-[10px] font-bold text-white">Monthly</button>
                  <button className="flex-1 rounded-lg border border-slate-200 py-1.5 text-[10px] text-slate-500">Bi-weekly</button>
                </div>
                <p className="mt-2 text-center text-base font-bold text-brand-navy">$85/mo</p>
                <p className="text-center text-[9px] text-slate-400">10 payments · 0% interest</p>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <span className="inline-flex rounded-full bg-brand-sky px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-navy">
              Patient Pay
            </span>
            <h3 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              A patient billing experience they'll actually use
            </h3>
            <p className="mt-4 leading-relaxed text-slate-600">
              Replace confusing paper statements with a mobile-first patient
              portal that explains bills in plain English, offers flexible
              payment plans, and matches patients to financial assistance — all
              branded to your health system.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Mobile app (iOS + Android) with one-tap payment",
                "AI bill explainer: plain-English answers to billing questions",
                "Flexible payment plans — Monthly, Bi-weekly, Auto-Pay or Promise-to-Pay",
                "Financial assistance matching: Medicaid, ACA, charity care",
                "SMS + push notification outreach with propensity-to-pay scoring",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
                    ✓
                  </span>
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/platform"
              className="mt-8 inline-flex items-center gap-1 text-sm font-semibold text-brand-navy underline-offset-4 hover:underline"
            >
              See Patient Pay →
            </Link>
          </div>
        </div>

        {/* Intelligence */}
        <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex rounded-full bg-brand-sky px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-navy">
              Intelligence
            </span>
            <h3 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              Revenue insights that drive action, not reports
            </h3>
            <p className="mt-4 leading-relaxed text-slate-600">
              Track denial trends by payer, CPT, and provider. Monitor your
              clean claim rate in real time. Score patients by propensity to
              pay. Give your RCM leadership the data they need to act — not
              just review.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Denial trend dashboards by payer, code, and provider",
                "Clean claim rate and first-pass acceptance tracking",
                "AR aging and revenue leakage signals",
                "Propensity-to-pay scoring for patient outreach prioritization",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs text-white">
                    ✓
                  </span>
                  <span className="text-sm text-slate-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* Stats mockup */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Intelligence · November 2025
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: "Clean claim rate", value: "91.4%", change: "+6.2%", up: true },
                  { label: "Denial rate", value: "22.1%", change: "-18.4%", up: true },
                  { label: "Avg days to pay", value: "18d", change: "-11d", up: true },
                  { label: "Recovery rate", value: "78%", change: "+23%", up: true },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] text-slate-400">{s.label}</p>
                    <p className="mt-1 text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-[10px] font-medium text-emerald-600">
                      {s.change} vs. baseline
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Top denial reasons this month
                </p>
                {[
                  { reason: "Missing prior auth", pct: 34 },
                  { reason: "Diagnosis specificity", pct: 28 },
                  { reason: "Modifier error", pct: 21 },
                ].map((d) => (
                  <div key={d.reason} className="mb-2">
                    <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                      <span>{d.reason}</span>
                      <span>{d.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-coral"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CEDAR COMPARISON ── */}
      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-coral">
            What makes Anang different
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900">
            Other platforms fix denials after they happen.
            <br />
            <span className="text-brand-navy">We stop them before they do.</span>
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              {
                label: "Reactive platforms",
                desc: "Identify denied claims in your AR bucket. Help staff appeal and resubmit. The denial already happened — you already lost the cash flow.",
                tone: "text-slate-400",
                bg: "bg-white border-slate-200",
              },
              {
                label: "Anang",
                desc: "Catch the denial risk before submission. Fix the modifier, sharpen the diagnosis, flag the prior auth — while the encounter is still fresh. The claim goes out clean the first time.",
                tone: "text-brand-navy",
                bg: "bg-brand-sky/40 border-brand-navy/20 ring-1 ring-brand-navy/10",
                highlight: true,
              },
              {
                label: "Manual review",
                desc: "Experienced coders catch some issues — but not payer-specific rule changes from last quarter, or the CPT that started requiring prior auth in January. Rules change faster than humans can track.",
                tone: "text-slate-400",
                bg: "bg-white border-slate-200",
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`rounded-xl border p-6 ${c.bg}`}
              >
                {c.highlight && (
                  <span className="mb-2 inline-block rounded-full bg-brand-navy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Our approach
                  </span>
                )}
                <h3 className={`font-semibold ${c.tone} mt-1`}>{c.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-coral">
          How it works
        </p>
        <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-slate-900">
          Up and running in days, not months
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Connect your EHR",
              body: "We integrate with Epic, Greenway Intergy, and other major EHRs via FHIR R4 and HL7 — no rip-and-replace, no new system for your clinical team.",
            },
            {
              step: "02",
              title: "Claims AI reviews every encounter",
              body: "Before submission, our engine checks each claim against deterministic rules, payer-specific policies, and historical denial patterns — then surfaces a prioritized issue list for your billing team.",
            },
            {
              step: "03",
              title: "Patients get a better billing experience",
              body: "Statements go out digitally with plain-English explanations. Patients pay via the mobile app, set up plans, or get matched to assistance — reducing bad debt without more staff.",
            },
          ].map((s) => (
            <div key={s.step} className="relative pl-12">
              <span className="absolute left-0 top-0 text-4xl font-black text-brand-sky">
                {s.step}
              </span>
              <h3 className="font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TRUST / COMPLIANCE ── */}
      <section className="border-t border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-slate-400">
            Built for healthcare compliance
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-x-12 gap-y-6">
            {[
              { label: "HIPAA Compliant", icon: "🔒" },
              { label: "BAA Available", icon: "📄" },
              { label: "SOC 2 (in progress)", icon: "🛡️" },
              { label: "Multi-tenant data isolation", icon: "🏗️" },
              { label: "Audit log on every action", icon: "📋" },
              { label: "FHIR R4 + SMART on FHIR", icon: "🔗" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-2 text-sm font-medium text-slate-600"
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BUILT FOR HEALTH SYSTEMS ── */}
      <section className="border-y border-brand-navy-dark/20 bg-brand-navy py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Built for health-system reality
          </h2>
          <p className="mt-3 max-w-2xl text-white/70">
            Enterprise healthcare procurement is different. We built Anang
            knowing it.
          </p>
          <ul className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Multi-tenant SaaS",
                body: "Isolated org data, module entitlements, and audit-friendly patterns — ready for enterprise IT and legal review.",
              },
              {
                title: "White-label ready",
                body: "Per-tenant branding on the patient portal and mobile app. Patients see your health system's name and logo, not ours.",
              },
              {
                title: "Human in the loop",
                body: "AI suggests; your billing leaders approve. No silent auto-submit. Every change is traceable, reversible, and auditable.",
              },
            ].map((f) => (
              <li key={f.title}>
                <p className="font-semibold text-brand-coral">{f.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {f.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Ready to cut your denial rate in half?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          Schedule a 30-minute demo. We'll show you exactly how Claims AI would
          work with your EHR and payer mix.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <a
            href={bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-lg bg-brand-coral px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-hover"
          >
            Book a demo
          </a>
          <Link
            href="/pilot"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-brand-navy shadow-sm transition hover:bg-slate-50"
          >
            Request a pilot
          </Link>
          <a
            href={`${appUrl}/login`}
            className="inline-flex items-center px-4 py-3 text-sm font-medium text-brand-navy underline-offset-4 hover:underline"
          >
            Sign in to platform →
          </a>
        </div>
      </section>
    </main>
  );
}

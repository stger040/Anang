import Link from "next/link";
import { getBrand } from "@anang/brand";
import { PageCta } from "@/components/page-cta";

export const metadata = { title: "Platform" };

export default async function PlatformPage() {
  const b = getBrand();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900">Platform</h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600">
        The {b.product.suiteName} platform follows a unified data model:
        patients, encounters, claims, statements, and audit events — with
        module entitlements controlling what each client sees.
      </p>

      <div className="mt-12 space-y-10">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Two products, one platform</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-navy">Claims AI</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Stop denials before submission</h3>
              <p className="mt-2 text-sm text-slate-600">
                AI checks every encounter for documentation gaps, missing modifiers, and
                payer-specific denial risks before the claim leaves your system. Human-in-the-loop
                approval on every change. Denial outcomes feed back into the model — denial rates
                drop over time as the AI learns your successful claims.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-coral">Patient Pay</p>
              <h3 className="mt-2 text-base font-semibold text-slate-900">Patient financial engagement, reimagined</h3>
              <p className="mt-2 text-sm text-slate-600">
                Mobile-first patient billing app with an AI agent that explains bills in plain English,
                flexible payment plans, one-tap Stripe payments, and financial assistance matching.
                Patients pay more when they understand what they owe and have a frictionless way to pay.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-600">
            Both products share a single tenant data model: patients, encounters, claims, statements,
            and a HIPAA-compliant audit log. Module entitlements control exactly what each client
            can see and do.
          </p>
        </section>
        <Link
          href="/modules"
          className="inline-flex font-medium text-brand-navy hover:underline"
        >
          View technical module details →
        </Link>
      </div>

      <PageCta title="See the product" />

      <p className="mt-10">
        <Link href="/" className="text-sm font-medium text-brand-navy hover:underline">
          ← Back home
        </Link>
      </p>
    </div>
  );
}

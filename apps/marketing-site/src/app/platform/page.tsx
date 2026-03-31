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
          <h2 className="text-lg font-semibold text-slate-900">Core ideas</h2>
          <ul className="mt-4 list-inside list-disc space-y-2 text-slate-600">
            <li>
              <strong>Build</strong> — AI-assisted coding & documentation
              checks before submission; denial risk surfaced with explainability.
            </li>
            <li>
              <strong>Pay</strong> — Patient balances, statements, and payment
              status in staff workflows.
            </li>
            <li>
              <strong>Connect</strong> — Claim lifecycle visibility: draft
              through paid/denied/appealed; clearinghouse placeholders.
            </li>
            <li>
              <strong>Insight</strong> — Operational metrics health systems
              expect: denials, clean claim rate, AR.
            </li>
            <li>
              <strong>Support & Cover</strong> — Staff operations and
              affordability / coverage journeys.
            </li>
          </ul>
        </section>
        <Link
          href="/modules"
          className="inline-flex font-medium text-brand-navy hover:underline"
        >
          View all modules →
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

import Link from "next/link";
import { getBrand } from "@anang/brand";

export const metadata = { title: "Pilot & contact" };

export default async function PilotPage() {
  const b = getBrand();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900">
        Request a pilot
      </h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        We’re onboarding a small number of design partners. Tell us about your
        health system and which {b.product.suiteName} modules matter most —
        especially <strong>Build</strong> for denial prevention.
      </p>

      <div className="mt-10 max-w-lg rounded-xl border border-slate-200 bg-slate-50 p-8">
        <p className="text-sm font-medium text-slate-700">
          Next step (placeholder)
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Wire this form to HubSpot, Plain, or your inbox. For now, email{" "}
          <a
            href="mailto:hello@anang.ai"
            className="font-medium text-teal-800 underline"
          >
            hello@anang.ai
          </a>{" "}
          with subject line &quot;Pilot — [Health system name]&quot;.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm font-medium text-teal-800 hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </div>
  );
}

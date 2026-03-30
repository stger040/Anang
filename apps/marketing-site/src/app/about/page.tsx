import { getBrand } from "@anang/brand";

export const metadata = { title: "About" };

export default async function AboutPage() {
  const b = getBrand();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900">About</h1>
      <div className="prose prose-slate mt-8 max-w-2xl">
        <p>
          {b.company.displayName} builds software for U.S. healthcare providers
          who need a modern, unified approach to revenue cycle — from how
          claims are constructed to how patients understand and pay their bills.
        </p>
        <p>
          Our focus is <strong>proactive denial prevention</strong>: catching
          documentation gaps, coding mismatches, and payer-specific risk
          <em> before </em>
          submission, while keeping providers in control.
        </p>
        <p className="text-sm text-slate-500">
          {b.company.legalName} · Building in public beta with select health
          systems.
        </p>
      </div>
    </div>
  );
}

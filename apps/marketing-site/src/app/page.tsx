import Link from "next/link";
import { getBrand } from "@anang/brand";

export default async function HomePage() {
  const b = getBrand();
  const appUrl = `https://${b.company.platformSubdomain}`;

  return (
    <main>
      <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            AI revenue cycle platform
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
            Stop losing revenue to denials before they happen.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            {b.company.displayName} unifies patient financial engagement and
            claims operations in one modular platform — with{" "}
            <strong>proactive denial prevention</strong> and{" "}
            <strong>AI-assisted claims build</strong> as a core differentiator.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/pilot"
              className="inline-flex rounded-lg bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800"
            >
              Request a pilot
            </Link>
            <a
              href={`${appUrl}/login`}
              className="inline-flex rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Book a demo
            </a>
            <Link
              href="/platform"
              className="inline-flex items-center px-2 py-3 text-sm font-medium text-teal-800 hover:underline"
            >
              Explore the platform →
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-2xl font-semibold text-slate-900">
          One platform. Only the modules you need.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600">
          Health systems license {b.product.suiteName} by module — so you
          deploy faster and align spend to outcomes.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: b.modules.build.label,
              body: b.modules.build.description,
              highlight: true,
            },
            {
              title: b.modules.pay.label,
              body: b.modules.pay.description,
            },
            {
              title: b.modules.connect.label,
              body: b.modules.connect.description,
            },
            {
              title: b.modules.insight.label,
              body: b.modules.insight.description,
            },
            {
              title: b.modules.support.label,
              body: b.modules.support.description,
            },
            {
              title: b.modules.cover.label,
              body: b.modules.cover.description,
            },
          ].map((m) => (
            <div
              key={m.title}
              className={`rounded-xl border p-6 ${m.highlight ? "border-teal-200 bg-teal-50/40 ring-1 ring-teal-100" : "border-slate-200 bg-white"}`}
            >
              {m.highlight && (
                <span className="text-xs font-semibold uppercase text-teal-800">
                  Flagship
                </span>
              )}
              <h3 className="mt-2 font-semibold text-slate-900">{m.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {m.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold">
            Built for health-system reality
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            <li>
              <p className="font-medium text-teal-300">Multi-tenant SaaS</p>
              <p className="mt-2 text-sm text-slate-300">
                Isolated org data, module entitlements, and audit-friendly
                patterns — ready for enterprise procurement.
              </p>
            </li>
            <li>
              <p className="font-medium text-teal-300">White-label ready</p>
              <p className="mt-2 text-sm text-slate-300">
                Per-tenant branding fields so patient and staff experiences
                stay on your brand.
              </p>
            </li>
            <li>
              <p className="font-medium text-teal-300">Human in the loop</p>
              <p className="mt-2 text-sm text-slate-300">
                AI suggests; your coders and billing leaders approve. No silent
                auto-submit of claims.
              </p>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}

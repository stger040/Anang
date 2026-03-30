import { getBrand } from "@anang/brand";

export const metadata = { title: "Modules" };

export default async function ModulesPage() {
  const b = getBrand();
  const mods = [
    b.modules.build,
    b.modules.pay,
    b.modules.connect,
    b.modules.insight,
    b.modules.support,
    b.modules.cover,
    b.modules.core,
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900">Modules</h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        License only what you need. Each module is designed to share the same
        tenant boundary, security model, and audit trail.
      </p>
      <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
        {mods.map((m) => (
          <div key={m.key} className="grid gap-4 py-10 sm:grid-cols-3">
            <div className="font-mono text-xs text-teal-800">{m.key}</div>
            <div className="sm:col-span-2">
              <h2 className="text-xl font-semibold text-slate-900">
                {m.label}
              </h2>
              <p className="mt-2 text-slate-600">{m.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

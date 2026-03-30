import { getBrand } from "@anang/brand";
import { DemoLoginButton } from "@/components/demo-login-button";
import { Card } from "@anang/ui";
import Link from "next/link";

const DEMO_ACCOUNTS = [
  {
    label: "Super admin (cross-tenant)",
    email: "super@anang.internal",
    hint: "Platform /admin",
  },
  {
    label: "LCO Health Center — tenant admin (full modules)",
    email: "admin@lco.anang.demo",
    hint: "All modules enabled",
  },
  {
    label: "Tamarack Health — staff (no Connect/Support/Cover)",
    email: "rcm@tamarack.anang.demo",
    hint: "Selective entitlements",
  },
  {
    label: "Demo tenant — staff (Pay + Insight only)",
    email: "viewer@demo.anang.demo",
    hint: "Build/Connect hidden",
  },
] as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const b = getBrand();

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            {b.product.suiteName}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Sign in (demo)
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Cookie-based demo session for pilots. Replace with enterprise SSO
            before production.
          </p>
        </div>

        {sp.error === "forbidden" ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            You do not have access to that area.
          </p>
        ) : null}
        {sp.error === "no_org" ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This account has no organization membership.
          </p>
        ) : null}

        <Card className="divide-y divide-slate-100 p-0">
          {DEMO_ACCOUNTS.map((a) => (
            <div
              key={a.email}
              className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{a.label}</p>
                <p className="truncate font-mono text-xs text-slate-500">
                  {a.email}
                </p>
                <p className="text-xs text-slate-500">{a.hint}</p>
              </div>
              <DemoLoginButton email={a.email} />
            </div>
          ))}
        </Card>

        <p className="mt-6 text-center text-xs text-slate-500">
          Marketing site:{" "}
          <Link className="text-teal-800 underline" href="https://anang.ai">
            anang.ai
          </Link>
        </p>
      </div>
    </div>
  );
}

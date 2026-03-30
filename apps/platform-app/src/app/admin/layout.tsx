import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Anang
          </p>
          <p className="text-sm font-semibold text-slate-900">Platform admin</p>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/admin" className="text-slate-600 hover:text-slate-900">
            Tenants
          </Link>
          <Link href="/admin/audit" className="text-slate-600 hover:text-slate-900">
            Global audit
          </Link>
          <Link href="/login" className="text-slate-600 hover:text-slate-900">
            Switch user
          </Link>
          <SignOutButton />
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}

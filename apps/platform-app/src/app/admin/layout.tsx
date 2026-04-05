import { auth } from "@/auth";
import { SignOutButton } from "@/components/sign-out-button";
import { AppRole } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.appRole !== AppRole.SUPER_ADMIN) {
    redirect("/login?error=forbidden");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/brand/logo-trans-light-bg.svg"
            alt="Anang"
            width={128}
            height={28}
            className="h-7 w-auto"
          />
          <div>
            <p className="text-sm font-semibold text-slate-900">Platform admin</p>
            <p className="text-xs text-slate-500">Cross-tenant operator</p>
          </div>
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

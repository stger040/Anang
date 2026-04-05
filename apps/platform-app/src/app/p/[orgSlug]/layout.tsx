import { PatientWebPushRegister } from "@/components/patient-web-push-register";
import { tenantPrisma } from "@/lib/prisma";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}): Promise<Metadata> {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { slug: orgSlug },
    select: { displayName: true, primaryColor: true },
  });
  return {
    title: tenant
      ? `Pay your bill · ${tenant.displayName}`
      : "Pay your bill",
    robots: { index: false, follow: false },
    manifest: "/patient-manifest.json",
    themeColor: tenant?.primaryColor ?? "#0f766e",
    appleWebApp: {
      capable: true,
      title: tenant ? `Billing · ${tenant.displayName}` : "Patient billing",
    },
  };
}

export default async function PatientPayOrgLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100/80 antialiased text-slate-900">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <PatientWebPushRegister orgSlug={orgSlug} />
      </div>
      {children}
      <footer className="mx-auto max-w-3xl px-4 py-10 text-center text-[11px] text-slate-500">
        Protected connection · For questions about your bill, contact your care
        provider&apos;s billing department.
      </footer>
    </div>
  );
}

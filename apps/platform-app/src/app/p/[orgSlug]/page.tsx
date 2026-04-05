import { tenantPrisma } from "@/lib/prisma";
import { Card } from "@anang/ui";
import { notFound } from "next/navigation";

/** Public landing: patients reach statements via magic link from outreach. */
export default async function PatientPayOrgHome({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  return (
    <div className="min-h-[60vh] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-lg">
        <p className="text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {tenant.displayName}
        </p>
        <h1 className="mt-3 text-center text-2xl font-semibold text-slate-900">
          Billing
        </h1>
        <Card className="mt-8 p-6 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-700">
            To view your balance or make a payment, open the secure link we sent
            you by text or email. That link signs you in for this statement only —
            you do not need a separate account.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            If your link expired or you need help, contact {tenant.displayName}{" "}
            billing and ask for a new Pay link.
          </p>
        </Card>
      </div>
    </div>
  );
}

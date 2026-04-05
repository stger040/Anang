import { tenantPrisma } from "@/lib/prisma";
import { Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

export default async function TenantAuditPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const events = await tenantPrisma(orgSlug).auditEvent.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Immutable-ish event trail placeholder. Production should stream to SIEM and retain according to client BAA."
        actions={
          <Link href={`/o/${orgSlug}/settings`}>
            <Button type="button" variant="secondary" size="sm">
              Back to settings
            </Button>
          </Link>
        }
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Actor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No audit events yet for this tenant.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-slate-600">
                    {e.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                  <td className="px-4 py-3 text-slate-700">{e.resource}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">
                    {e.actorUserId ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

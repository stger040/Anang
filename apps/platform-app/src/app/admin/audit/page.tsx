import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@anang/ui";

export default async function AdminAuditPage() {
  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { tenant: { select: { slug: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global audit stream"
        description="Latest platform events across tenants (demo volume only). Filter and export should map to SOC2 control narratives later."
      />

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-slate-600">
                  {e.createdAt.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {e.tenant?.slug ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{e.action}</td>
                <td className="px-4 py-3 text-slate-700">{e.resource}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

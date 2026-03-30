import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

export default async function TenantUsersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const memberships = await prisma.membership.findMany({
    where: { tenantId: tenant.id },
    include: { user: true },
    orderBy: { id: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users & roles"
        description="Membership links users to this tenant. Super admins are not listed here — they manage from /admin."
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
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tenant role</th>
              <th className="px-4 py-3">Global role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {memberships.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {m.user.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                  {m.user.email}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="teal">{m.role}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone="default">{m.user.appRole}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

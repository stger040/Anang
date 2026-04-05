import { tenantPrisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import { AppRole } from "@prisma/client";
import Link from "next/link";

import { StaffModuleAccessEditor } from "./staff-module-access-editor";

function staffModuleAccessLabel(
  role: AppRole,
  allowList: { length: number },
): string {
  if (role !== AppRole.STAFF) return "—";
  if (allowList.length === 0) return "All entitled modules";
  return `${allowList.length} module(s) restricted`;
}

export default async function TenantUsersPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const memberships = await tenantPrisma(orgSlug).membership.findMany({
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
              <th className="px-4 py-3">Staff module access</th>
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
                <td className="px-4 py-3 text-xs text-slate-600">
                  {staffModuleAccessLabel(m.role, m.staffModuleAllowList)}
                </td>
                <td className="px-4 py-3">
                  <Badge tone="default">{m.user.appRole}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {memberships.some((m) => m.role === AppRole.STAFF) ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Staff module restrictions
          </h2>
          <p className="mt-2 text-xs text-slate-600">
            Limit which product areas each <strong>staff</strong> member can open
            (sidebar + APIs). Leave all boxes unchecked for full access to every
            module this tenant has purchased. Tenant admins are not restricted.
          </p>
          <div className="mt-4 space-y-4 divide-y divide-slate-100">
            {memberships
              .filter((m) => m.role === AppRole.STAFF)
              .map((m) => (
                <StaffModuleAccessEditor
                  key={`${m.id}-${[...m.staffModuleAllowList].sort().join(",")}`}
                  orgSlug={orgSlug}
                  membershipId={m.id}
                  userEmail={m.user.email}
                  defaultAllowList={[...m.staffModuleAllowList]}
                />
              ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

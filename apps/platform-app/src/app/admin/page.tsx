import { prisma } from "@/lib/prisma";
import { Badge, Card, Button, PageHeader } from "@anang/ui";
import Link from "next/link";

export default async function AdminHomePage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      moduleEntitlements: { where: { enabled: true } },
      _count: { select: { memberships: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Create organizations, set purchased modules, and add members. Staging sign-in uses the platform password until SSO is wired."
        actions={
          <Link
            href="/admin/tenants/new"
            className="inline-flex items-center justify-center rounded-lg border border-brand-coral-hover/30 bg-brand-coral px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-coral-hover"
          >
            New tenant
          </Link>
        }
      />

      <div className="grid gap-4">
        {tenants.map((t) => (
          <Card key={t.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {t.displayName}
                </h2>
                <p className="mt-1 font-mono text-xs text-slate-500">/{t.slug}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.moduleEntitlements.map((e) => (
                    <Badge key={e.id} tone="teal">
                      {e.module}
                    </Badge>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {t._count.memberships} membership(s)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/tenants/${t.slug}`}>
                  <Button type="button" variant="secondary">
                    Manage
                  </Button>
                </Link>
                <Link href={`/o/${t.slug}/dashboard`}>
                  <Button type="button" variant="secondary">
                    Open workspace
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

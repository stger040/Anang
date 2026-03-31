import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader } from "@anang/ui";
import Link from "next/link";

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: orgSlug },
    include: { moduleEntitlements: true },
  });
  if (!tenant) return null;

  const settings = tenant.settings as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant settings"
        description="Profile, entitlements, and white-label placeholders. Super admins can see all tenants from /admin."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">Legal name</dt>
              <dd className="font-medium text-slate-900">{tenant.name}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Display name</dt>
              <dd className="font-medium text-slate-900">{tenant.displayName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Slug</dt>
              <dd className="font-mono text-slate-800">{tenant.slug}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            White-label (placeholders)
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-500">Primary color</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block h-5 w-5 rounded border border-slate-200"
                  style={{ backgroundColor: tenant.primaryColor }}
                />
                <span className="font-mono text-xs">{tenant.primaryColor}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Logo URL</dt>
              <dd className="text-slate-600">{tenant.logoUrl ?? "— not set"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Future: signed upload to object storage + CDN; theme tokens in design
            system package.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Module entitlements
          </h2>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <Link href={`/o/${orgSlug}/settings/users`} className="text-brand-navy underline">
              User management →
            </Link>
            <Link href={`/o/${orgSlug}/settings/audit`} className="text-brand-navy underline">
              Audit log →
            </Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tenant.moduleEntitlements
            .sort((a, b) => a.module.localeCompare(b.module))
            .map((e) => (
              <Badge key={e.id} tone={e.enabled ? "success" : "default"}>
                {e.module} · {e.enabled ? "on" : "off"}
              </Badge>
            ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Source of truth is database — product navigation hides disabled modules.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Tenant JSON settings</h2>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
          {JSON.stringify(settings, null, 2)}
        </pre>
      </Card>
    </div>
  );
}

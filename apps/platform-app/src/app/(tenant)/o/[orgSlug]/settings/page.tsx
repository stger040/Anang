import { prisma } from "@/lib/prisma";
import { getIntegrationStatus } from "@/lib/integration-status";
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
  const integration = getIntegrationStatus();

  const laneTone = (lane: string) => {
    if (lane === "live") return "success" as const;
    if (lane === "test_ready") return "info" as const;
    if (lane === "local") return "warning" as const;
    return "default" as const;
  };

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
        <h2 className="text-sm font-semibold text-slate-900">
          Integration readiness
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          What we can ship in code without your vendor contracts is already in the
          product shell; this panel shows what the **deploy** knows about the next
          layer (keys optional). See repo{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">docs/PATH_TO_FULL_PRODUCT.md</code>{" "}
          for the full owner split.
        </p>
        <ul className="mt-4 space-y-4 text-sm">
          <li>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">EHR / data source</span>
              <Badge tone={laneTone(integration.dataSource.lane)}>
                {integration.dataSource.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.dataSource.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">
                Greenway / Intergy FHIR (pilot 1)
              </span>
              <Badge tone={laneTone(integration.greenwayFhir.lane)}>
                {integration.greenwayFhir.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.greenwayFhir.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">
                Epic on FHIR (pilot 2 — planned)
              </span>
              <Badge tone={laneTone(integration.epicFhir.lane)}>
                {integration.epicFhir.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.epicFhir.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">
                FHIR bundle import
              </span>
              <Badge tone={laneTone(integration.fhirFixtureImport.lane)}>
                {integration.fhirFixtureImport.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">
              {integration.fhirFixtureImport.detail}
            </p>
            <p className="mt-2 font-mono text-[10px] text-slate-500">
              Sample bundle (repo):{" "}
              <span className="break-all">
                apps/platform-app/
                {integration.fhirFixtureImport.exampleBundlePath}
              </span>
            </p>
            <Link
              href={`/o/${orgSlug}/settings/implementation`}
              className="mt-2 inline-block text-xs font-medium text-brand-navy underline"
            >
              Implementation hub — paste R4 Bundle →
            </Link>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">
                Medical AI — bill line explain (Pay)
              </span>
              <Badge tone={laneTone(integration.medicalAiBillExplain.lane)}>
                {integration.medicalAiBillExplain.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">
              {integration.medicalAiBillExplain.detail}
            </p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">Payments</span>
              <Badge tone={laneTone(integration.payments.lane)}>
                {integration.payments.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.payments.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">Outbound comms</span>
              <Badge tone={laneTone(integration.outboundComms.lane)}>
                {integration.outboundComms.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.outboundComms.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">Clearinghouse</span>
              <Badge tone={laneTone(integration.clearinghouse.lane)}>
                {integration.clearinghouse.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">{integration.clearinghouse.detail}</p>
          </li>
          <li className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-800">
                Pharmacy / NCPDP (optional)
              </span>
              <Badge tone={laneTone(integration.pharmacyClaims.lane)}>
                {integration.pharmacyClaims.lane}
              </Badge>
            </div>
            <p className="mt-1 text-slate-600">
              {integration.pharmacyClaims.detail}
            </p>
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Machine-readable:{" "}
          <code className="rounded bg-slate-100 px-1">GET /api/integrations/status</code>
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Implementation (first client)
          </h2>
          <Link
            href={`/o/${orgSlug}/settings/implementation`}
            className="text-sm font-medium text-brand-navy underline"
          >
            Implementation hub →
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Billing and IT discovery checklists, contacts, and optional FHIR R4
          bundle paste when your feed is not wired yet.
        </p>
      </Card>

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

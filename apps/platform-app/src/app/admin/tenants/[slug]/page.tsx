import { getAppOrigin } from "@/lib/app-origin";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import { parseTenantAuthSettings } from "@/lib/tenant-auth-settings";
import { Badge, Card, PageHeader } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddMemberForm } from "./add-member-form";
import { InviteMemberForm } from "./invite-member-form";
import { TenantAuthSettingsForm } from "./tenant-auth-form";

export default async function AdminTenantDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = validateTenantSlug(raw);
  if (!slug) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      moduleEntitlements: { orderBy: { module: "asc" } },
      memberships: {
        include: { user: { select: { id: true, email: true, name: true, appRole: true } } },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!tenant) notFound();

  const enabled = tenant.moduleEntitlements.filter((e) => e.enabled);
  const authSettings = parseTenantAuthSettings(
    (tenant.settings as Record<string, unknown>)?.auth,
  );
  const oidcRedirectUri = `${getAppOrigin()}/api/auth/tenant-oidc/${tenant.slug}/callback`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={tenant.displayName}
        description={`/${tenant.slug} · ${tenant.name}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/o/${tenant.slug}/dashboard`}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            >
              Open workspace
            </Link>
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
            >
              All tenants
            </Link>
          </div>
        }
      />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Authentication & SSO
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Control whether this organization may use internal passwords, optional
          OIDC, or SSO-only. Does not change Auth.js globally — see{" "}
          <code className="rounded bg-slate-100 px-1">docs/CLIENT_IT_OIDC_ONBOARDING.md</code>.
        </p>
        <div className="mt-4">
          <TenantAuthSettingsForm
            slug={tenant.slug}
            currentPolicy={authSettings.policy}
            currentIssuer={authSettings.oidc?.issuer ?? ""}
            currentClientId={authSettings.oidc?.clientId ?? ""}
            oidcRedirectUri={oidcRedirectUri}
            currentJitProvisioning={authSettings.jitProvisioning === true}
            currentJitMembershipRole={
              authSettings.jitMembershipRole === "TENANT_ADMIN"
                ? "TENANT_ADMIN"
                : "STAFF"
            }
          />
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Modules</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {enabled.length === 0 ? (
            <p className="text-sm text-slate-600">No modules enabled.</p>
          ) : (
            enabled.map((e) => (
              <Badge key={e.id} tone="teal">
                {e.module}
              </Badge>
            ))
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Members</h2>
        <p className="mt-1 text-xs text-slate-500">
          Tenant admins can manage this org in the workspace when those screens
          exist; until then, provision here. Session still uses the staging
          password from env.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Membership role</th>
                <th className="py-2">User app role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tenant.memberships.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 pr-4 text-slate-800">{m.user.name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-slate-600">
                    {m.user.email}
                  </td>
                  <td className="py-2 pr-4">{m.role}</td>
                  <td className="py-2 text-slate-600">{m.user.appRole}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenant.memberships.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No members yet.</p>
          ) : null}
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Invite link (sign-in required)
          </h3>
          <div className="mt-4">
            <InviteMemberForm slug={tenant.slug} />
          </div>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">
            Add or update member
          </h3>
          <div className="mt-4">
            <AddMemberForm slug={tenant.slug} />
          </div>
        </div>
      </Card>
    </div>
  );
}

import { getSession } from "@/lib/session";
import { canAccessTenantAdminRoutes } from "@/lib/tenant-admin-guard";
import { assertOrgAccess } from "@/lib/tenant-context";
import { notFound, redirect } from "next/navigation";

/**
 * Server guard for all `/o/[orgSlug]/settings/**` pages.
 * Staff must not access org admin (users, audit, raw settings JSON, entitlements UI).
 */
export default async function TenantSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  if (!canAccessTenantAdminRoutes(session, ctx.membershipRole)) {
    redirect(`/o/${orgSlug}/dashboard`);
  }

  return <>{children}</>;
}

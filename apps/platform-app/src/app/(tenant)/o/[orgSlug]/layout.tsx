import { PlatformShell } from "@/components/platform-shell";
import { getDemoSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { notFound, redirect } from "next/navigation";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getDemoSession();
  if (!session) redirect("/login");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  return (
    <PlatformShell
      orgSlug={orgSlug}
      tenantName={ctx.tenant.displayName}
      enabledModules={Array.from(ctx.enabledModules)}
      userEmail={session.email}
    >
      {children}
    </PlatformShell>
  );
}

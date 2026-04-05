import { platformLog } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";

/**
 * Optional header when opening `/o/...` as super-admin without tenant membership.
 * Use a **ticket / case id only** — no PHI or free-text clinical content.
 */
export async function readSupportAccessContextFromHeaders(): Promise<
  string | undefined
> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const raw = h.get("x-anang-support-context")?.trim();
  if (!raw) return undefined;
  return raw.slice(0, 256);
}

/** Log + persist when a platform super-admin enters a tenant workspace without a membership row. */
export async function emitSuperAdminCrossTenantAccess(opts: {
  userId: string;
  tenantId: string;
  orgSlug: string;
  requestId?: string;
  supportContext?: string;
}): Promise<void> {
  platformLog("warn", "platform.super_admin.cross_tenant_workspace", {
    userId: opts.userId,
    orgSlug: opts.orgSlug,
    tenantId: opts.tenantId,
    ...(opts.requestId ? { requestId: opts.requestId } : {}),
    ...(opts.supportContext ? { supportContext: opts.supportContext } : {}),
  });
  try {
    await prisma.auditEvent.create({
      data: {
        tenantId: opts.tenantId,
        actorUserId: opts.userId,
        action: "platform.super_admin.cross_tenant_workspace",
        resource: "tenant_workspace",
        metadata: {
          orgSlug: opts.orgSlug,
          ...(opts.requestId ? { requestId: opts.requestId } : {}),
          ...(opts.supportContext ? { supportContext: opts.supportContext } : {}),
        },
      },
    });
  } catch {
    platformLog("error", "platform.super_admin.cross_tenant_audit_persist_failed", {
      tenantId: opts.tenantId,
      userId: opts.userId,
    });
  }
}

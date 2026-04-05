import { createHash, randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";
import { AppRole } from "@prisma/client";

export const INVITE_EXPIRY_DAYS = 14;

export type InviteFulfillResult =
  | { ok: true; tenantSlug: string }
  | { ok: false; code: "invalid" | "expired" | "consumed" | "email_mismatch" };

export function generateInviteRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashInviteToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export async function fulfillInviteForUser(
  rawToken: string | undefined,
  userId: string,
  emailLower: string,
  opts?: { requestId?: string },
): Promise<InviteFulfillResult> {
  const raw = rawToken?.trim();
  if (!raw || raw.length < 16) return { ok: false, code: "invalid" };

  const tokenHash = hashInviteToken(raw);
  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash },
    include: { tenant: { select: { slug: true, id: true } } },
  });

  if (!invite) return { ok: false, code: "invalid" };
  if (invite.consumedAt) return { ok: false, code: "consumed" };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, code: "expired" };

  if (invite.email !== emailLower) {
    return { ok: false, code: "email_mismatch" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, code: "invalid" };

  let memRole = invite.membershipRole;
  if (memRole === AppRole.SUPER_ADMIN) {
    memRole = AppRole.TENANT_ADMIN;
  }

  const staffAllowList =
    memRole === AppRole.STAFF ? invite.staffModuleAllowList : [];

  await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: {
        userId_tenantId: { userId, tenantId: invite.tenantId },
      },
      create: {
        userId,
        tenantId: invite.tenantId,
        role: memRole,
        staffModuleAllowList: staffAllowList,
      },
      update: { role: memRole, staffModuleAllowList: staffAllowList },
    });
    await tx.userInvite.update({
      where: { id: invite.id },
      data: { consumedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: invite.tenantId,
        actorUserId: userId,
        action: "platform.invite.consumed",
        resource: "user_invite",
        metadata: {
          email: emailLower,
          membershipRole: memRole,
          ...(opts?.requestId ? { requestId: opts.requestId } : {}),
        },
      },
    });
  });

  return { ok: true, tenantSlug: invite.tenant.slug };
}

export type InvitePreview =
  | {
      ok: true;
      tenantSlug: string;
      tenantDisplayName: string;
      email: string;
      membershipRole: AppRole;
    }
  | { ok: false; code: "invalid" | "expired" | "consumed" };

export async function loadInvitePreview(rawToken: string): Promise<InvitePreview> {
  const raw = rawToken?.trim();
  if (!raw || raw.length < 16) return { ok: false, code: "invalid" };

  const invite = await prisma.userInvite.findUnique({
    where: { tokenHash: hashInviteToken(raw) },
    include: { tenant: { select: { slug: true, displayName: true } } },
  });
  if (!invite) return { ok: false, code: "invalid" };
  if (invite.consumedAt) return { ok: false, code: "consumed" };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, code: "expired" };

  return {
    ok: true,
    tenantSlug: invite.tenant.slug,
    tenantDisplayName: invite.tenant.displayName,
    email: invite.email,
    membershipRole: invite.membershipRole,
  };
}

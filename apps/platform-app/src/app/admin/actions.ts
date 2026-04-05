"use server";

import { getAppOrigin } from "@/lib/app-origin";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { prisma } from "@/lib/prisma";
import { validateTenantSlug } from "@/lib/platform-slug";
import { getSession } from "@/lib/session";
import { sendTenantInviteEmail } from "@/lib/invite-email";
import { parseStaffModuleKeysFromForm } from "@/lib/staff-module-form";
import {
  INVITE_EXPIRY_DAYS,
  generateInviteRawToken,
  hashInviteToken,
} from "@/lib/user-invite";
import { AppRole, ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ALL_MODULES = Object.values(ModuleKey);

export type AdminActionState = { error: string } | null;
export type AddMemberState = { error?: string; ok?: boolean } | null;

export type CreateInviteState =
  | null
  | { error: string }
  | {
      ok: true;
      inviteUrl: string;
      emailDelivery: "sent" | "skipped" | "failed";
      emailDeliveryDetail?: string;
    };

type TenantSideMembershipRole = "TENANT_ADMIN" | "STAFF";

function requireSuperAdmin(session: Awaited<ReturnType<typeof getSession>>) {
  if (!session) return "You must be signed in.";
  if (session.appRole !== AppRole.SUPER_ADMIN) {
    return "Only a platform super administrator can do this.";
  }
  return null;
}

function parseHexColor(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "#0f766e";
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return null;
}

export async function createTenant(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await getSession();
  const authErr = requireSuperAdmin(session);
  if (authErr) return { error: authErr };
  if (!session) return { error: "Session missing." };

  const slugRaw = String(formData.get("slug") ?? "");
  const slug = validateTenantSlug(slugRaw);
  if (!slug) {
    return {
      error:
        "Slug must be 2–48 chars: lowercase letters, digits, single hyphens (not reserved).",
    };
  }

  const name = String(formData.get("name") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!name || !displayName) {
    return { error: "Name and display name are required." };
  }

  const color = parseHexColor(String(formData.get("primaryColor") ?? ""));
  if (!color) {
    return { error: "Primary color must be a #RRGGBB hex value or left blank." };
  }

  const selected = new Set(
    formData
      .getAll("module")
      .map((v) => String(v).trim())
      .filter((k): k is ModuleKey => (Object.values(ModuleKey) as string[]).includes(k)),
  );
  selected.add(ModuleKey.CORE);

  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    return { error: `A tenant with slug “${slug}” already exists.` };
  }

  const requestIdCreate = await readRequestIdFromHeaders();
  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          displayName,
          primaryColor: color,
          settings: {},
        },
      });
      for (const m of ALL_MODULES) {
        await tx.moduleEntitlement.create({
          data: {
            tenantId: tenant.id,
            module: m,
            enabled: selected.has(m),
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: tenant.id,
          actorUserId: session.userId,
          action: "platform.tenant.created",
          resource: "tenant",
          metadata: {
            slug,
            modules: [...selected].sort(),
            ...(requestIdCreate ? { requestId: requestIdCreate } : {}),
          },
        },
      });
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not create tenant (database error)." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${slug}`);
  redirect(`/admin/tenants/${slug}`);
}

async function upsertUserForTenantRole(
  email: string,
  name: string,
  membershipRole: TenantSideMembershipRole,
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.appRole === AppRole.SUPER_ADMIN) {
      return existing;
    }
    const nextAppRole =
      membershipRole === AppRole.TENANT_ADMIN ||
      existing.appRole === AppRole.TENANT_ADMIN
        ? AppRole.TENANT_ADMIN
        : AppRole.STAFF;
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: name || existing.name, appRole: nextAppRole },
    });
  }
  return prisma.user.create({
    data: {
      email,
      name,
      appRole:
        membershipRole === AppRole.TENANT_ADMIN
          ? AppRole.TENANT_ADMIN
          : AppRole.STAFF,
    },
  });
}

export async function addTenantMember(
  _prev: AddMemberState,
  formData: FormData,
): Promise<AddMemberState> {
  const session = await getSession();
  const authErr = requireSuperAdmin(session);
  if (authErr) return { error: authErr };
  if (!session) return { error: "Session missing." };

  const slug = validateTenantSlug(String(formData.get("slug") ?? ""));
  if (!slug) return { error: "Invalid tenant slug." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const roleRaw = String(formData.get("membershipRole") ?? "").trim();

  if (!email || !name) {
    return { error: "Email and name are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  let membershipRole: TenantSideMembershipRole;
  if (roleRaw === "TENANT_ADMIN") membershipRole = "TENANT_ADMIN";
  else if (roleRaw === "STAFF") membershipRole = "STAFF";
  else return { error: "Choose tenant admin or staff role." };

  const staffAllowList =
    membershipRole === "STAFF" ? parseStaffModuleKeysFromForm(formData) : [];

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return { error: "Tenant not found." };

  try {
    const user = await upsertUserForTenantRole(email, name, membershipRole);
    if (user.appRole === AppRole.SUPER_ADMIN) {
      return {
        error:
          "This email is a super admin account — add a dedicated staff email for tenant work.",
      };
    }
    await prisma.membership.upsert({
      where: {
        userId_tenantId: { userId: user.id, tenantId: tenant.id },
      },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        role: membershipRole,
        staffModuleAllowList:
          membershipRole === "STAFF" ? staffAllowList : [],
      },
      update: {
        role: membershipRole,
        staffModuleAllowList:
          membershipRole === "STAFF" ? staffAllowList : [],
      },
    });
    const requestIdMember = await readRequestIdFromHeaders();
    await prisma.auditEvent.create({
      data: {
        tenantId: tenant.id,
        actorUserId: session.userId,
        action: "platform.membership.upserted",
        resource: "membership",
        metadata: {
          userId: user.id,
          email,
          membershipRole,
          ...(membershipRole === "STAFF" && staffAllowList.length
            ? { staffModuleAllowList: staffAllowList.sort() }
            : {}),
          ...(requestIdMember ? { requestId: requestIdMember } : {}),
        },
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not add member (database error)." };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${slug}`);
  return { ok: true };
}

export async function createTenantInvite(
  _prev: CreateInviteState,
  formData: FormData,
): Promise<CreateInviteState> {
  const session = await getSession();
  const authErr = requireSuperAdmin(session);
  if (authErr) return { error: authErr };
  if (!session) return { error: "Session missing." };

  const slug = validateTenantSlug(String(formData.get("slug") ?? ""));
  if (!slug) return { error: "Invalid tenant slug." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleRaw = String(formData.get("membershipRole") ?? "").trim();

  if (!email) return { error: "Email is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  let membershipRole: TenantSideMembershipRole;
  if (roleRaw === "TENANT_ADMIN") membershipRole = "TENANT_ADMIN";
  else if (roleRaw === "STAFF") membershipRole = "STAFF";
  else return { error: "Choose tenant admin or staff role." };

  const staffInviteAllowList =
    membershipRole === "STAFF" ? parseStaffModuleKeysFromForm(formData) : [];

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return { error: "Tenant not found." };

  const rawToken = generateInviteRawToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

  try {
    await prisma.userInvite.create({
      data: {
        tenantId: tenant.id,
        email,
        membershipRole,
        staffModuleAllowList:
          membershipRole === "STAFF" ? staffInviteAllowList : [],
        tokenHash,
        expiresAt,
        createdByUserId: session.userId,
      },
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not create invite (database error)." };
  }

  const base = getAppOrigin();
  const inviteUrl = `${base}/invite/${rawToken}`;

  const roleLabel =
    membershipRole === "TENANT_ADMIN" ? "Tenant administrator" : "Staff";
  const emailResult = await sendTenantInviteEmail({
    to: email,
    inviteUrl,
    tenantDisplayName: tenant.displayName,
    roleLabel,
  });

  const requestIdInvite = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId: tenant.id,
      actorUserId: session.userId,
      action: "platform.invite.created",
      resource: "user_invite",
      metadata: {
        email,
        membershipRole,
        ...(membershipRole === "STAFF" && staffInviteAllowList.length
          ? { staffModuleAllowList: staffInviteAllowList.sort() }
          : {}),
        emailDelivery: emailResult.status,
        ...(emailResult.status === "failed"
          ? { emailError: emailResult.message }
          : {}),
        ...(requestIdInvite ? { requestId: requestIdInvite } : {}),
      },
    },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/tenants/${slug}`);
  return {
    ok: true,
    inviteUrl,
    emailDelivery: emailResult.status,
    ...(emailResult.status === "failed"
      ? { emailDeliveryDetail: emailResult.message }
      : {}),
  };
}

"use server";

import { prisma } from "@/lib/prisma";
import { readRequestIdFromHeaders } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

const STATUSES = new Set([
  "open",
  "in_progress",
  "waiting_patient",
  "resolved",
]);

const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

const CATEGORIES = new Set([
  "billing_question",
  "payment_plan",
  "coverage",
  "other",
]);

export async function createSupportTask(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const detail = String(formData.get("detail") ?? "").trim() || null;
  const patientId = String(formData.get("patientId") ?? "").trim() || null;
  const statementId = String(formData.get("statementId") ?? "").trim() || null;
  const priority = String(formData.get("priority") ?? "normal").trim();
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!orgSlug || !title || !PRIORITIES.has(priority)) {
    throw new Error("Invalid form");
  }
  if (category && !CATEGORIES.has(category)) throw new Error("Invalid category");

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.SUPPORT)) {
    throw new Error("Forbidden");
  }

  const tenantId = ctx.tenant.id;

  if (patientId) {
    const p = await prisma.patient.findFirst({
      where: { id: patientId, tenantId },
    });
    if (!p) throw new Error("Patient not found");
  }

  if (statementId) {
    const s = await prisma.statement.findFirst({
      where: { id: statementId, tenantId },
    });
    if (!s) throw new Error("Statement not found");
  }

  await prisma.supportTask.create({
    data: {
      tenantId,
      patientId,
      statementId,
      title,
      detail,
      priority,
      category,
      status: "open",
    },
  });

  const requestId = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "support.task.created",
      resource: "support_task",
      metadata: { title, ...(requestId ? { requestId } : {}) },
    },
  });

  revalidatePath(`/o/${orgSlug}/support`, "page");
}

export async function updateSupportTaskStatus(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const orgSlug = String(formData.get("orgSlug") ?? "").trim();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  if (!orgSlug || !taskId || !STATUSES.has(status)) {
    throw new Error("Invalid payload");
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.SUPPORT)) {
    throw new Error("Forbidden");
  }

  const tenantId = ctx.tenant.id;

  const row = await prisma.supportTask.findFirst({
    where: { id: taskId, tenantId },
  });
  if (!row) throw new Error("Not found");

  await prisma.supportTask.update({
    where: { id: taskId },
    data: { status },
  });

  const requestId = await readRequestIdFromHeaders();
  await prisma.auditEvent.create({
    data: {
      tenantId,
      actorUserId: session.userId,
      action: "support.task.status",
      resource: "support_task",
      metadata: { taskId, status, ...(requestId ? { requestId } : {}) },
    },
  });

  revalidatePath(`/o/${orgSlug}/support`, "page");
}

import { computePriorAuthSlaFlags } from "@/lib/prior-auth/sla";
import { tenantPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { PageHeader } from "@anang/ui";
import { ModuleKey, PriorAuthStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { ConnectSubnav } from "../connect-subnav";
import { PriorAuthWorkspace } from "./prior-auth-workspace";

export default async function ConnectAuthorizationsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();
  if (!session) notFound();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.CONNECT)) notFound();

  const tenantRow = await tenantPrisma(orgSlug).tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { settings: true },
  });
  const impl = parseImplementationSettings(
    tenantRow?.settings &&
      typeof tenantRow.settings === "object" &&
      !Array.isArray(tenantRow.settings)
      ? (tenantRow.settings as Record<string, unknown>).implementation
      : null,
  );
  const pa = impl?.priorAuth;

  const cases = await tenantPrisma(orgSlug).priorAuthCase.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ updatedAt: "desc" }],
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
    },
  });

  const patients = await tenantPrisma(orgSlug).patient.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 120,
    select: { id: true, firstName: true, lastName: true, mrn: true },
  });

  const now = new Date();
  const expiringSoonDays = pa?.expiringSoonDays ?? 14;
  const followUpIntervalHours = pa?.followUpIntervalHours ?? 48;
  const activeDue: PriorAuthStatus[] = [
    PriorAuthStatus.SUBMITTED,
    PriorAuthStatus.IN_REVIEW,
    PriorAuthStatus.PENDING_INFO,
  ];

  const rows = cases.map((c) => {
    const sla = computePriorAuthSlaFlags(c, {
      now,
      expiringSoonDays,
      followUpIntervalHours,
      activeDueStatuses: activeDue,
    });
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      status: c.status,
      payerName: c.payerName,
      scheduledAt: c.scheduledAt,
      dueAt: c.dueAt,
      expiresAt: c.expiresAt,
      updatedAt: c.updatedAt,
      patient: c.patient,
      sla,
    };
  });

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="authorizations" />
      <PageHeader
        title="Connect — prior authorizations"
        description="Medical-benefit PA tracking inside Connect (Phase 1). Staff checklist, services, SLA hints, and audit trail — no automated payer submission."
      />
      <PriorAuthWorkspace orgSlug={orgSlug} cases={rows} patients={patients} />
    </div>
  );
}

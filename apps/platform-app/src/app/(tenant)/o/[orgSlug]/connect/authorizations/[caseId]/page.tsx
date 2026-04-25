import { tenantPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { ModuleKey } from "@prisma/client";
import { notFound } from "next/navigation";

import { ConnectSubnav } from "../../connect-subnav";
import { PriorAuthDetail } from "../prior-auth-detail";

export default async function PriorAuthCaseDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; caseId: string }>;
}) {
  const { orgSlug, caseId } = await params;
  const session = await getSession();
  if (!session) notFound();
  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx?.effectiveModules.has(ModuleKey.CONNECT)) notFound();

  const c = await tenantPrisma(orgSlug).priorAuthCase.findFirst({
    where: { id: caseId, tenantId: ctx.tenant.id },
    include: {
      patient: true,
      encounter: { select: { id: true, dateOfService: true } },
      claim: { select: { id: true, claimNumber: true } },
      coverage: { select: { id: true, payerName: true, planName: true } },
      checklistItems: { orderBy: { sortOrder: "asc" } },
      services: { orderBy: { sortOrder: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });
  if (!c) notFound();

  const claims = await tenantPrisma(orgSlug).claim.findMany({
    where: { tenantId: ctx.tenant.id, patientId: c.patientId },
    orderBy: { submittedAt: "desc" },
    take: 20,
    select: { id: true, claimNumber: true, status: true },
  });

  const encounters = await tenantPrisma(orgSlug).encounter.findMany({
    where: { tenantId: ctx.tenant.id, patientId: c.patientId },
    orderBy: { dateOfService: "desc" },
    take: 15,
    select: { id: true, dateOfService: true },
  });

  return (
    <div className="space-y-6">
      <ConnectSubnav orgSlug={orgSlug} current="authorizations" />
      <PriorAuthDetail orgSlug={orgSlug} caseRow={c} claims={claims} encounters={encounters} />
    </div>
  );
}

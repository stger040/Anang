import { prisma } from "@/lib/prisma";
import { CLAIM_STATUSES } from "@anang/types";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

const STATUS_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info" | "teal"> =
  {
    DRAFT: "default",
    READY: "info",
    SUBMITTED: "info",
    ACCEPTED: "success",
    DENIED: "danger",
    PAID: "success",
    APPEALED: "warning",
  };

export default async function ConnectClaimsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const claims = await prisma.claim.findMany({
    where: { tenantId: tenant.id },
    orderBy: { submittedAt: "desc" },
    include: { patient: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connect — claims lifecycle"
        description="Clearinghouse-ready scaffolding with payer timelines and remittance placeholders. States mirror real revenue cycle milestones."
        actions={
          <span className="text-xs text-slate-500">
            States: {CLAIM_STATUSES.join(", ")}
          </span>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Claim #</th>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Payer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billed</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs">{c.claimNumber}</td>
                  <td className="px-4 py-3 text-slate-800">
                    {c.patient
                      ? `${c.patient.lastName}, ${c.patient.firstName}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.payerName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[c.status] ?? "default"}>
                      {c.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {usd(c.billedCents)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {c.paidCents != null ? usd(c.paidCents) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/o/${orgSlug}/connect/claims/${c.id}`}>
                      <Button type="button" size="sm" variant="secondary">
                        Timeline
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Connectivity (placeholders)
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Clearinghouse</p>
            <p className="mt-1">
              Future: enrollment, submission windows, ACK monitoring, SFTP/API
              keys in secrets manager.
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Payer EDI</p>
            <p className="mt-1">
              277/835 parsers and denial taxonomy mapping — currently mocked in
              timeline events.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

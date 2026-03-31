import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ClaimTimelinePage({
  params,
}: {
  params: Promise<{ orgSlug: string; claimId: string }>;
}) {
  const { orgSlug, claimId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const claim = await prisma.claim.findFirst({
    where: { id: claimId, tenantId: tenant.id },
    include: { patient: true, timeline: { orderBy: { at: "asc" } } },
  });
  if (!claim) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Claim ${claim.claimNumber}`}
        description={claim.patient ? `${claim.patient.lastName}, ${claim.patient.firstName}` : "Patient not linked in seed"}
        actions={
          <Link href={`/o/${orgSlug}/connect`}>
            <Button type="button" variant="secondary" size="sm">
              Back to claims
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Payer & remittance (mock)
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="info">{claim.status.toLowerCase()}</Badge>
            {claim.payerName ? (
              <Badge tone="default">{claim.payerName}</Badge>
            ) : null}
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs uppercase text-slate-500">Billed</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {usd(claim.billedCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Paid</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {claim.paidCents != null ? usd(claim.paidCents) : "—"}
              </dd>
            </div>
          </dl>
          {claim.denialReason ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase text-red-800">
                Denial / adjustment reason (seed)
              </p>
              <p className="mt-2 text-sm text-red-900">{claim.denialReason}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">EDI stubs</h2>
          <ul className="mt-4 space-y-2 text-xs text-slate-600">
            <li>837P envelope: DEMO-ENV-{claim.claimNumber}</li>
            <li>277CA file: incoming / mock bucket</li>
            <li>835 trace: BR-{claim.id.slice(0, 6).toUpperCase()}</li>
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
        <ol className="relative mt-6 space-y-6 border-l border-slate-200 pl-6">
          {claim.timeline.map((ev, i) => (
            <li key={ev.id} className="relative">
              <span className="absolute -left-[25px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-brand-coral" />
              <p className="text-sm font-medium text-slate-900">{ev.label}</p>
              {ev.detail ? (
                <p className="mt-0.5 text-sm text-slate-600">{ev.detail}</p>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">
                {ev.at.toLocaleString()} {i === claim.timeline.length - 1 ? "· latest" : ""}
              </p>
            </li>
          ))}
        </ol>
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

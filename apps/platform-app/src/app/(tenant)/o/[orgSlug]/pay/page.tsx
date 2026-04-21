import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";

export default async function PayStatementsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const statements = await tenantPrisma(orgSlug).statement.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dueDate: "desc" },
    include: { patient: true, payments: true },
  });

  const patients = await tenantPrisma(orgSlug).patient.findMany({
    where: { tenantId: tenant.id },
    orderBy: { lastName: "asc" },
    take: 12,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pay — patient financials"
        description="Use Pay after claims adjudication to manage patient responsibility. Typical actions: open statement detail, explain line items, send patient pay links, and coordinate follow-up with Support or Cover."
      />

      <Card className="border-slate-200 bg-slate-50/70 p-4">
        <h2 className="text-sm font-semibold text-slate-900">When to use Pay</h2>
        <p className="mt-1 text-sm text-slate-700">
          Pay is the patient financial operations hub. Start with a statement,
          then route unresolved questions to Support and affordability needs to
          Cover. Use Insight to summarize impact.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link
            href={`/o/${orgSlug}/connect`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Related module: Connect
          </Link>
          <Link
            href={`/o/${orgSlug}/support`}
            className="rounded-full bg-brand-sky/30 px-2 py-1 font-medium text-brand-navy"
          >
            Next related module: Support
          </Link>
          <Link
            href={`/o/${orgSlug}/cover`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Affordability path: Cover
          </Link>
          <Link
            href={`/o/${orgSlug}/insight`}
            className="rounded-full bg-white px-2 py-1 text-slate-600"
          >
            Summary module: Insight
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-3 border-teal-100 bg-gradient-to-r from-teal-50/60 to-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Pre-visit &amp; estimates (Pay + Pre)
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Deposits, GFE-aware flows, and appointment hooks — same Pay module,
                staff configuration surface.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/o/${orgSlug}/pay/patient-preview`}>
                <Button type="button" size="sm" variant="secondary">
                  Patient experience preview
                </Button>
              </Link>
              <Link href={`/o/${orgSlug}/pay/pre`}>
                <Button type="button" size="sm" variant="primary">
                  Open pre-visit hub
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Statements</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Number</th>
                  <th className="py-2 pr-4">Patient</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Balance</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Due</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs">{s.number}</span>
                        {isFhirFixtureImportStatementNumber(s.number) ? (
                          <Badge tone="default">FHIR</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {s.patient.lastName}, {s.patient.firstName}
                    </td>
                    <td className="py-3 pr-4 tabular-nums text-slate-700">
                      {usd(s.totalCents)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums font-medium text-slate-900">
                      {usd(s.balanceCents)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        tone={
                          s.status === "open"
                            ? "warning"
                            : s.status === "paid"
                              ? "success"
                              : "default"
                        }
                      >
                        {s.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {s.dueDate.toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Link href={`/o/${orgSlug}/pay/statements/${s.id}`}>
                        <Button type="button" size="sm" variant="secondary">
                          Open statement
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
            Patient lookup
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Mock directory — future: typeahead against MPI / registration index.
          </p>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {patients.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-900">
                  {p.lastName}, {p.firstName}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {p.mrn ?? p.id.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

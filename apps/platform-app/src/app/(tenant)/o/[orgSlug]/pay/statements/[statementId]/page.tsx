import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Button } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; statementId: string }>;
}) {
  const { orgSlug, statementId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const stmt = await prisma.statement.findFirst({
    where: { id: statementId, tenantId: tenant.id },
    include: { patient: true, lines: true, payments: true },
  });
  if (!stmt) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Statement ${stmt.number}`}
        description={`${stmt.patient.lastName}, ${stmt.patient.firstName}`}
        actions={
          <Link href={`/o/${orgSlug}/pay`}>
            <Button type="button" variant="secondary" size="sm">
              Back to list
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                stmt.status === "open"
                  ? "warning"
                  : stmt.status === "paid"
                    ? "success"
                    : "default"
              }
            >
              {stmt.status.replace("_", " ")}
            </Badge>
            <span className="text-sm text-slate-600">
              Due {stmt.dueDate.toLocaleDateString()}
            </span>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-slate-500">Total</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {usd(stmt.totalCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Balance</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {usd(stmt.balanceCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Payments</dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-900">
                {stmt.payments.length}
              </dd>
            </div>
          </dl>

          <h3 className="mt-8 text-sm font-semibold text-slate-900">Lines</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-2 text-left">Code</th>
                  <th className="py-2 text-left">Description</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stmt.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 font-mono text-xs">{l.code}</td>
                    <td className="py-2 text-slate-700">{l.description}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {usd(l.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">
            Payment activity
          </h3>
          <ul className="mt-4 space-y-3 text-sm">
            {stmt.payments.length === 0 ? (
              <li className="text-slate-500">No payments posted.</li>
            ) : (
              stmt.payments.map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
                >
                  <p className="font-medium text-slate-900">
                    {usd(p.amountCents)} · {p.status}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.method ?? "method n/a"}{" "}
                    {p.paidAt ? `· ${p.paidAt.toLocaleDateString()}` : ""}
                  </p>
                </li>
              ))
            )}
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

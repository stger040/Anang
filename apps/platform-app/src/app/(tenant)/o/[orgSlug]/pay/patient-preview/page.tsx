import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { Badge, Button, Card, PageHeader } from "@anang/ui";
import Link from "next/link";

export default async function PayPatientPreviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) return null;

  const statements = await tenantPrisma(orgSlug).statement.findMany({
    where: { tenantId: tenant.id },
    orderBy: { dueDate: "asc" },
    include: { patient: true },
  });

  const withBalance = statements.filter(
    (s) => s.status === "open" && s.balanceCents > 0,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Patient experience preview"
        description="Staff preview of the patient-facing balance view: same sign-in as today, plain-language copy, and one path to checkout. Not a separate patient login."
      />

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <Link href={`/o/${orgSlug}/pay`}>
          <Button type="button" size="sm" variant="secondary">
            ← Staff Pay workspace
          </Button>
        </Link>
      </div>

      <Card className="border-amber-100 bg-amber-50/40 p-5">
        <p className="text-sm text-slate-800">
          This page mimics how a patient might see an open balance after a visit:
          friendly greeting, amount due, due date, and one primary action. Data is
          the same as the statements table — still tenant staff sign-in. For the
          real patient experience (magic link, no login), open{" "}
          <strong>View details &amp; pay</strong> → create a{" "}
          <strong>Patient Pay link</strong> on the statement, then open that URL
          in a private window.
        </p>
      </Card>

      {withBalance.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm font-medium text-slate-900">
            No open balances right now
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Seed data may have paid everything, or statements are not yet created.
            Add statements from the staff Pay page or ledger integration to see
            cards here.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {withBalance.map((s) => {
            const p = s.patient;
            const given = greetingFirstName(p.firstName);
            return (
              <li key={s.id}>
                <Card className="flex h-full flex-col p-6 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Hello, {given}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    You have a balance to review
                  </p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">
                    {usd(s.balanceCents)}{" "}
                    <span className="text-sm font-normal text-slate-600">
                      due
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Due{" "}
                    <time dateTime={s.dueDate.toISOString()}>
                      {s.dueDate.toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })}
                    </time>
                  </p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    Statement {s.number}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={s.status === "open" ? "warning" : "default"}>
                      {s.status.replace("_", " ")}
                    </Badge>
                    {isFhirFixtureImportStatementNumber(s.number) ? (
                      <Badge tone="default">Demo · FHIR import</Badge>
                    ) : null}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Link href={`/o/${orgSlug}/pay/statements/${s.id}`}>
                      <Button type="button" size="sm" variant="primary">
                        View details &amp; pay
                      </Button>
                    </Link>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function greetingFirstName(firstName: string) {
  return firstName.trim() || "there";
}

function usd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

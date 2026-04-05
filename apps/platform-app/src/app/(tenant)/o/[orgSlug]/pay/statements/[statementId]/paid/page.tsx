import { isFhirFixtureImportStatementNumber } from "@/lib/fhir-pay-statement";
import { tenantPrisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-server";
import { Badge, Button, Card, PageHeader } from "@anang/ui";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function StatementPaidPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; statementId: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { orgSlug, statementId } = await params;
  const { session_id: sessionId } = await searchParams;

  const tenant = await tenantPrisma(orgSlug).tenant.findUnique({ where: { slug: orgSlug } });
  if (!tenant) notFound();

  const stmtExists = await tenantPrisma(orgSlug).statement.findFirst({
    where: { id: statementId, tenantId: tenant.id },
    select: { id: true, number: true, balanceCents: true },
  });
  if (!stmtExists) notFound();

  const fromFhirFixture = isFhirFixtureImportStatementNumber(stmtExists.number);

  let sessionOk = false;
  const stripe = getStripe();
  if (sessionId && stripe) {
    try {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      sessionOk =
        s.payment_status === "paid" &&
        s.metadata?.statementId === statementId &&
        s.metadata?.tenantId === tenant.id;
    } catch {
      sessionOk = false;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment submitted"
        description={`Statement ${stmtExists.number}`}
        actions={
          <Link href={`/o/${orgSlug}/pay/statements/${statementId}`}>
            <Button type="button" variant="secondary" size="sm">
              View statement
            </Button>
          </Link>
        }
      />

      {fromFhirFixture ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="default">FHIR bundle import</Badge>
          <span className="text-xs text-slate-600">
            Imported statement — verify against your source system.
          </span>
        </div>
      ) : null}

      <Card className="p-5">
        <p className="text-sm text-slate-700">
          {sessionOk
            ? "Stripe confirmed this checkout session for this statement. Balances update when the webhook runs (usually within seconds)."
            : sessionId
              ? "We could not verify the checkout session, or processing is still in flight. Refresh the statement in a moment to see the updated balance."
              : "If you completed checkout, the statement balance updates after Stripe sends the webhook. Open the statement to confirm."}
        </p>
        {stmtExists.balanceCents === 0 ? (
          <p className="mt-3 text-sm font-medium text-emerald-800">
            This statement shows a zero balance.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

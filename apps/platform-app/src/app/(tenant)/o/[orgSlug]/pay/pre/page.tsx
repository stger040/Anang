import { Card, PageHeader, Badge, Button } from "@anang/ui";
import Link from "next/link";

/** Pre-visit financial surface — grouped with Pay in product story (MODULES_CUSTOMER). */
export default async function PayPreVisitPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pay — pre-visit & estimates"
        description="Good-faith estimates, deposits, and pre-registration hooks. Wire schedule + charge master from EHR/PM; counsel-approved copy only in production."
        actions={
          <Link href={`/o/${orgSlug}/pay`}>
            <Button type="button" variant="secondary" size="sm">
              Back to Pay
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            GFE / transparency
            <Badge tone="info">Policy</Badge>
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Configure per-tenant estimate templates, NSA / state rules, and
            delivery channels (SMS, portal, native). No PHI-specific estimate
            engine until your estimate service is wired.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Deposits &amp; card on file
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Same payment rails as statement Pay (Stripe or enterprise gateway).
            Staff view lists scheduled visits with deposit status when EHR feed
            exists.
          </p>
        </Card>
        <Card className="p-5 lg:col-span-2 border-teal-100 bg-teal-50/40">
          <h2 className="text-sm font-semibold text-teal-950">
            Upcoming visits (placeholder)
          </h2>
          <p className="mt-2 text-sm text-teal-900/90">
            Connect appointments API or HL7 SIU / FHIR Schedule to populate this
            table; until then, use the Pay statements list for post-visit
            balances.
          </p>
          <div className="mt-4 rounded-lg border border-dashed border-teal-200 bg-white/60 py-10 text-center text-sm text-teal-800/80">
            No appointment feed configured — connect schedule API next
          </div>
        </Card>
      </div>
    </div>
  );
}

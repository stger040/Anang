import { Card, EmptyState, PageHeader, Badge } from "@anang/ui";

export default async function CoverPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cover — affordability & coverage"
        description="Eligibility checks, estimates, charity care routing, and patient-friendly payment paths. Scaffold for future integration with clearinghouse + EDI 270/271."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Coverage verification (mock)
          </h2>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <p>
              <Badge tone="info">270/271</Badge> stub — wire to payer APIs or
              delegated vendor.
            </p>
            <EmptyState
              title="No active verifications"
              description="Queues appear when patient access journeys are enabled."
            />
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Affordability workflows
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            Payment plans, HBP/FAP policy routing, and propensity-informed offers
            belong here — keep policy text configurable per tenant for
            white-label rollouts.
          </p>
        </Card>
      </div>
    </div>
  );
}

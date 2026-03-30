import { Card, EmptyState, PageHeader, Badge, Button } from "@anang/ui";

export default async function SupportPage() {

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support — operations workspace"
        description="Staff queues for billing follow-ups, worklists, and SLA tracking. Scaffold only — workflows land after CRM/ERP hooks."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s queue</h2>
          <EmptyState
            title="No tasks seeded"
            description="Create work templates or import from PM to populate this surface."
          />
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">SLA preview (mock)</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="success">Within target · 92%</Badge>
            <Badge tone="warning">Risk · 6%</Badge>
            <Badge tone="danger">Breached · 2%</Badge>
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Replace with real task timestamps once ticketing or work queue API is
            connected.
          </p>
          <Button type="button" className="mt-4" variant="secondary" disabled>
            Configure queues (soon)
          </Button>
        </Card>
      </div>
    </div>
  );
}

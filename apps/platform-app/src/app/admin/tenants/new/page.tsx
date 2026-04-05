import { Card, PageHeader } from "@anang/ui";
import Link from "next/link";

import { TenantNewForm } from "./tenant-new-form";

export default function AdminNewTenantPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New tenant"
        description="Create a client organization row, module entitlements, and audit record. Operators still sign in with the staging password until SSO replaces this flow."
        actions={
          <Link
            href="/admin"
            className="text-sm font-medium text-brand-navy underline"
          >
            Back to tenants
          </Link>
        }
      />
      <Card className="p-6">
        <TenantNewForm />
      </Card>
    </div>
  );
}

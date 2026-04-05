import {
  greenwayEnvKeySuffixForTenantSlug,
  isGreenwayFhirClientCredentialsConfiguredForSuffix,
  readGreenwayFhirEnvConfigForTenant,
} from "@/lib/connectors/greenway-fhir";
import { prisma } from "@/lib/prisma";
import { isTenantSettingsEditor } from "@/lib/tenant-admin-guard";
import { parseImplementationSettings } from "@/lib/tenant-implementation-settings";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { Card, PageHeader } from "@anang/ui";
import Link from "next/link";
import { ModuleKey } from "@prisma/client";
import { notFound } from "next/navigation";

import { BuildKnowledgeChunksPanel } from "./build-knowledge-chunks-panel";
import { BuildRulePackForm } from "./build-rule-pack-form";
import { ImplementationForm } from "./implementation-form";
import { CsvImportForm } from "./csv-import-form";
import { FhirImportForm } from "./fhir-import-form";
import { GreenwayFhirTestForm } from "./greenway-fhir-test-form";
import { GreenwayFhirSyncActivity } from "./greenway-sync-activity";

export default async function ImplementationHubPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getSession();
  if (!session) notFound();

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx) notFound();

  const canEdit = await isTenantSettingsEditor(session, ctx.tenant.id);

  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: { settings: true },
  });
  const raw =
    tenant?.settings && typeof tenant.settings === "object"
      ? (tenant.settings as Record<string, unknown>)
      : {};
  const implementation = parseImplementationSettings(raw.implementation);
  const buildEnabled = ctx.enabledModules.has(ModuleKey.BUILD);
  const payEnabled = ctx.enabledModules.has(ModuleKey.PAY);

  const buildRulePackRow = buildEnabled
    ? await prisma.buildRulePack.findUnique({
        where: { tenantId: ctx.tenant.id },
        select: { config: true },
      })
    : null;
  const buildRulePackJson = buildRulePackRow?.config
    ? JSON.stringify(buildRulePackRow.config, null, 2)
    : "";

  const gwCfg = readGreenwayFhirEnvConfigForTenant(orgSlug, tenant?.settings);
  const gwEnvSuffix = greenwayEnvKeySuffixForTenantSlug(orgSlug);
  const gwHasAuth =
    Boolean(gwCfg?.accessToken) ||
    isGreenwayFhirClientCredentialsConfiguredForSuffix(gwEnvSuffix);
  const greenwayEnvStatus =
    !gwCfg?.baseUrl ? "missing" : !gwHasAuth ? "no_token" : "ready";

  const buildKnowledgeChunks = buildEnabled
    ? await prisma.buildKnowledgeChunk.findMany({
        where: { tenantId: ctx.tenant.id },
        orderBy: [{ kind: "asc" }, { lookupKey: "asc" }],
        select: {
          id: true,
          kind: true,
          lookupKey: true,
          title: true,
          body: true,
          sourceLabel: true,
        },
      })
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Implementation hub"
        description="First-client weeks 1–3: billing discovery + IT/EHR alignment. Checklists and contacts are stored in tenant settings (operational metadata, not clinical PHI)."
        actions={
          <Link
            href={`/o/${orgSlug}/settings`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
          >
            ← Settings
          </Link>
        }
      />

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          How this maps to your 6-week plan
        </h2>
        <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-600">
          <li>
            <strong>Weeks 1–3 (with billing + IT):</strong> work the discovery
            and workstream checklists here during working sessions; export audit
            later for the trust pack.
          </li>
          <li>
            <strong>No live EHR yet:</strong> use{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">
              docs/EPIC_AND_TEST_DATA.md
            </code>{" "}
            for vendor test environments, or paste a small FHIR Bundle below to
            rehearse Build / Pay handoffs.
          </li>
          <li>
            <strong>Weeks 4–6:</strong> track milestones in the notes field;
            cutover checklist can move to docs as you harden go-live.
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Written runbook:{" "}
          <code className="rounded bg-slate-100 px-1">
            docs/FIRST_CLIENT_ONBOARDING_6W.md
          </code>
        </p>
      </Card>

      <Card className="p-5">
        <ImplementationForm
          orgSlug={orgSlug}
          implementation={implementation}
          canEdit={canEdit}
        />
      </Card>

      {buildEnabled ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Build — deterministic rule pack
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Per-tenant calibration for the rules engine (disable checks or lower
            severity during pilot / shadow). Stored as operational config — not
            clinical content.
          </p>
          <div className="mt-4">
            <BuildRulePackForm
              orgSlug={orgSlug}
              initialJson={buildRulePackJson}
              canEdit={canEdit}
            />
          </div>
        </Card>
      ) : null}

      {buildEnabled ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Build — retrieval snippets (CPT / ICD-10)
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Short reference text keyed by code appears as citations on rule
            findings when staff open an encounter. Same layer as B3 seed chunks —
            curate per tenant without redeploying.
          </p>
          <div className="mt-4">
            <BuildKnowledgeChunksPanel
              orgSlug={orgSlug}
              chunks={buildKnowledgeChunks}
              canEdit={canEdit}
            />
          </div>
        </Card>
      ) : null}

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          FHIR bundle import
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          For dental / PM systems (e.g. Dentrix-class) you will still use the
          vendor&apos;s integration path in production; this import exercises
          the platform models only.
        </p>
        <div className="mt-4">
          <FhirImportForm
            orgSlug={orgSlug}
            canEdit={canEdit}
            buildEnabled={buildEnabled}
            payEnabled={payEnabled}
          />
          <CsvImportForm
            orgSlug={orgSlug}
            canEdit={canEdit}
            buildEnabled={buildEnabled}
            payEnabled={payEnabled}
          />
          <GreenwayFhirTestForm
            orgSlug={orgSlug}
            canEdit={canEdit}
            greenwayEnvStatus={greenwayEnvStatus}
          />
          <GreenwayFhirSyncActivity tenantId={ctx.tenant.id} />
        </div>
      </Card>
    </div>
  );
}

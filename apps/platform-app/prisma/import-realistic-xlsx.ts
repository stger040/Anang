/**
 * One-off import of synthetic Excel datasets into Postgres (local or Neon).
 *
 * Usage (from repo root):
 *   cd apps/platform-app
 *   npx tsx prisma/import-realistic-xlsx.ts --replace
 *
 * With Neon connection (uses apps/platform-app/.env.neon for DATABASE_URL):
 *   node --env-file=.env.neon ../../node_modules/tsx/dist/cli.mjs prisma/import-realistic-xlsx.ts --replace
 *
 * Paths default to REALISTIC_* env vars or the Downloads paths below if unset.
 *
 * Flags:
 *   --replace      Full wipe of tenant clinical/financial rows, then core + enrich import.
 *   --enrich-only  Upsert demographics + remittance only (tenant must exist; core data unchanged).
 *
 * @see docs/IMPORT_SYNTHETIC_DATASETS.md
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  PrismaClient,
  ModuleKey,
  ClaimLifecycleStatus,
  CanonicalResourceType,
  ClaimDraftLineSource,
} from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

const DEFAULT_CLAIMS = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "claims_data_realistic.xlsx",
);
const DEFAULT_ENCOUNTERS = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "ehr_encounters_realistic.xlsx",
);
const DEFAULT_LINES = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "claim_lines_realistic.xlsx",
);
const DEFAULT_PATIENT_DEMOGRAPHICS = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "patient_demographics_realistic.xlsx",
);
const DEFAULT_REMITTANCE = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  "Downloads",
  "remittance_adjudication_realistic.xlsx",
);

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function readSheetRows<T extends Record<string, unknown>>(
  filePath: string,
  sheetName: string,
): T[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath, { cellDates: true, dense: true });
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found in ${path.basename(filePath)}`);
  }
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: false,
  });
  return rows as T[];
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Workbook monetary columns are whole USD dollars; schema uses integer cents. */
function dollarsToCents(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function parseClaimLifecycleStatus(raw: string): ClaimLifecycleStatus {
  const s = raw.trim().toLowerCase();
  if (s === "paid") return ClaimLifecycleStatus.PAID;
  if (s === "denied") return ClaimLifecycleStatus.DENIED;
  if (s === "under review") return ClaimLifecycleStatus.SUBMITTED;
  if (s === "accepted") return ClaimLifecycleStatus.ACCEPTED;
  if (s === "draft" || s === "ready") {
    return raw.toLowerCase() === "ready"
      ? ClaimLifecycleStatus.READY
      : ClaimLifecycleStatus.DRAFT;
  }
  return ClaimLifecycleStatus.SUBMITTED;
}

function statementStatusFromOutcome(outcome: string): string {
  const o = outcome.trim().toLowerCase();
  if (o === "paid") return "paid";
  if (o === "partially paid") return "partially_paid";
  if (o === "denied") return "denied";
  return "open";
}

function balanceCentsForStatement(
  outcome: string,
  totalCents: number,
  paidCents: number | null,
): number {
  const o = outcome.trim().toLowerCase();
  if (o === "paid") return 0;
  if (o === "partially paid") {
    const from835 = paidCents != null ? totalCents - paidCents : null;
    if (from835 != null && from835 >= 0) return from835;
    return Math.round(totalCents * 0.35);
  }
  if (o === "denied") return totalCents;
  return Math.round(totalCents * 0.55);
}

async function wipeTenantScopedData(tenantId: string) {
  await prisma.remittanceAdjudicationLine.deleteMany({ where: { tenantId } });
  await prisma.claimAdjudication.deleteMany({ where: { tenantId } });
  await prisma.remittance835.deleteMany({ where: { tenantId } });
  await prisma.claim837EdiSubmission.deleteMany({ where: { tenantId } });
  await prisma.claimTimelineEvent.deleteMany({
    where: { claim: { tenantId } },
  });
  await prisma.claim.deleteMany({ where: { tenantId } });
  await prisma.claimIssue.deleteMany({
    where: { draft: { tenantId } },
  });
  await prisma.buildDraftEvent.deleteMany({ where: { tenantId } });
  await prisma.claimDraftLine.deleteMany({
    where: { draft: { tenantId } },
  });
  await prisma.claimDraft.deleteMany({ where: { tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId } });
  await prisma.statementLine.deleteMany({
    where: { statement: { tenantId } },
  });
  await prisma.statement.deleteMany({ where: { tenantId } });
  await prisma.supportTask.deleteMany({ where: { tenantId } });
  await prisma.coverAssistanceCase.deleteMany({ where: { tenantId } });
  await prisma.encounter.deleteMany({ where: { tenantId } });
  await prisma.coverage.deleteMany({ where: { tenantId } });
  await prisma.patient.deleteMany({ where: { tenantId } });
  await prisma.externalIdentifier.deleteMany({ where: { tenantId } });
  await prisma.sourceArtifact.deleteMany({ where: { tenantId } });
  await prisma.ingestionBatch.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
}

type ClaimRow = {
  claim_id: string;
  encounter_id: string;
  patient_id: string | number;
  date_of_service: Date | string;
  billed_amount: string | number;
  paid_amount: string | number | null;
  payer_name: string | null;
  claim_status: string;
  reason_code: string | null;
  outcome: string | null;
};

type EncounterRow = {
  encounter_id: string;
  claim_id: string;
  patient_id: string | number;
  date_of_service: Date | string;
  chief_complaint: string | null;
  history_present_illness: string | null;
  assessment_summary: string | null;
  primary_diagnosis_code: string | null;
  payer_name: string | null;
  insurance_type: string | null;
  procedure_code: string | number | null;
};

type LineRow = {
  claim_id: string;
  encounter_id: string;
  patient_id: string | number;
  line_number: string | number;
  procedure_code: string | number;
  procedure_description: string | null;
  modifier_1: string | null;
  modifier_2: string | null;
  units: string | number;
  line_billed_amount: string | number;
};

type DemographicsRow = {
  patient_id: string | number;
  mrn: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_initial: string | null;
  date_of_birth: Date | string | null;
  sex: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  preferred_language: string | null;
  marital_status: string | null;
  deceased_flag: string | boolean | number | null;
};

type ClaimAdjudicationExcelRow = {
  adjudication_id: string;
  remittance_id: string;
  claim_id: string;
  encounter_id: string | null;
  patient_id: string | number | null;
  provider_id: string | null;
  payer_name: string | null;
  insurance_type: string | null;
  claim_submission_date: Date | string | null;
  adjudication_date: Date | string | null;
  paid_date: Date | string | null;
  adjudication_phase: string | null;
  claim_status_at_adjudication: string | null;
  payer_claim_control_number: string | null;
  era_trace_number: string | null;
  allowed_amount_this_adjudication: string | number | null;
  paid_amount_this_remittance: string | number | null;
  patient_responsibility_amount: string | number | null;
  deductible_amount: string | number | null;
  copay_amount: string | number | null;
  coinsurance_amount: string | number | null;
  adjustment_amount: string | number | null;
  denial_category: string | null;
  finalized_flag: string | boolean | null;
  appeal_eligible_flag: string | boolean | null;
};

type RemittanceLineExcelRow = {
  remittance_line_id: string;
  remittance_id: string;
  adjudication_id: string;
  claim_id: string;
  claim_line_id: string | null;
  encounter_id: string | null;
  patient_id: string | number | null;
  provider_id: string | null;
  adjudication_date: Date | string | null;
  paid_date: Date | string | null;
  procedure_code: string | number | null;
  procedure_description: string | null;
  line_billed_amount: string | number | null;
  line_allowed_amount: string | number | null;
  line_paid_amount: string | number | null;
  patient_responsibility_amount: string | number | null;
  adjustment_amount: string | number | null;
  carc_code: string | null;
  carc_description: string | null;
  rarc_code: string | null;
  rarc_description: string | null;
  line_adjudication_status: string | null;
  denial_category: string | null;
};

function resolveDemographicsPath(): string {
  return (
    process.env.REALISTIC_PATIENT_DEMOGRAPHICS_XLSX?.trim() ||
    (fs.existsSync(DEFAULT_PATIENT_DEMOGRAPHICS)
      ? DEFAULT_PATIENT_DEMOGRAPHICS
      : "")
  );
}

function resolveRemittancePath(): string {
  return (
    process.env.REALISTIC_REMITTANCE_XLSX?.trim() ||
    (fs.existsSync(DEFAULT_REMITTANCE) ? DEFAULT_REMITTANCE : "")
  );
}

function parseOptionalDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDob(v: unknown): Date | null {
  return parseOptionalDate(v);
}

function parseBoolLoose(v: unknown): boolean {
  if (v === true || v === 1) return true;
  const s = toStr(v).toLowerCase();
  return s === "yes" || s === "true" || s === "1" || s === "y";
}

async function importPatientDemographics(tenantId: string, filePath: string) {
  console.log(`Importing patient demographics from ${path.basename(filePath)}…`);
  const rows = readSheetRows<DemographicsRow>(filePath, "patient_demographics");
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const pid = toStr(row.patient_id);
    if (!pid) {
      skipped++;
      continue;
    }
    const ext = await prisma.externalIdentifier.findFirst({
      where: {
        tenantId,
        system: "synthetic.patient_id",
        value: pid,
      },
    });
    if (!ext) {
      skipped++;
      continue;
    }

    const demographicsExtra = {
      middle_initial: toStr(row.middle_initial) || undefined,
      marital_status: toStr(row.marital_status) || undefined,
      deceased_flag: row.deceased_flag,
      import_sheet: "patient_demographics",
    };

    await prisma.patient.update({
      where: { id: ext.resourceId },
      data: {
        mrn: toStr(row.mrn) || `syn-${pid}`,
        firstName: toStr(row.first_name) || "Unknown",
        lastName: toStr(row.last_name) || "Unknown",
        dob: parseDob(row.date_of_birth),
        sex: toStr(row.sex) || null,
        phone: toStr(row.phone) || null,
        email: toStr(row.email) || null,
        addressLine1: toStr(row.address_line_1) || null,
        addressLine2: toStr(row.address_line_2) || null,
        city: toStr(row.city) || null,
        state: toStr(row.state) || null,
        postalCode: toStr(row.postal_code) || null,
        preferredLanguage: toStr(row.preferred_language) || null,
        demographicsExtra,
      },
    });
    updated++;
  }
  console.log(
    `Demographics: updated ${updated} patients; skipped ${skipped} (no matching synthetic.patient_id in tenant).`,
  );
}

function adjudicationUpsertData(
  row: ClaimAdjudicationExcelRow,
  remittance835Id: string,
  claimId: string,
  tenantId: string,
) {
  return {
    tenantId,
    remittance835Id,
    adjudicationKey: toStr(row.adjudication_id),
    claimId,
    encounterKey: toStr(row.encounter_id) || null,
    patientKey: row.patient_id != null ? toStr(row.patient_id) : null,
    providerKey: toStr(row.provider_id) || null,
    payerName: toStr(row.payer_name) || null,
    insuranceType: toStr(row.insurance_type) || null,
    claimSubmissionDate: parseOptionalDate(row.claim_submission_date),
    adjudicationDate: parseOptionalDate(row.adjudication_date),
    paidDate: parseOptionalDate(row.paid_date),
    adjudicationPhase: toStr(row.adjudication_phase) || null,
    claimStatusAtAdjudication:
      toStr(row.claim_status_at_adjudication) || null,
    payerClaimControlNumber: toStr(row.payer_claim_control_number) || null,
    allowedCents: dollarsToCents(row.allowed_amount_this_adjudication ?? 0),
    paidCents: dollarsToCents(row.paid_amount_this_remittance ?? 0),
    patientResponsibilityCents: dollarsToCents(
      row.patient_responsibility_amount ?? 0,
    ),
    deductibleCents: dollarsToCents(row.deductible_amount ?? 0),
    copayCents: dollarsToCents(row.copay_amount ?? 0),
    coinsuranceCents: dollarsToCents(row.coinsurance_amount ?? 0),
    adjustmentCents: dollarsToCents(row.adjustment_amount ?? 0),
    denialCategory: toStr(row.denial_category) || null,
    finalizedFlag: parseBoolLoose(row.finalized_flag),
    appealEligibleFlag: parseBoolLoose(row.appeal_eligible_flag),
    extra: {},
  };
}

async function importRemittanceAdjudication(tenantId: string, filePath: string) {
  console.log(`Importing remittance / adjudication from ${path.basename(filePath)}…`);
  const adjRows = readSheetRows<ClaimAdjudicationExcelRow>(
    filePath,
    "claim_adjudications",
  );
  const lineRows = readSheetRows<RemittanceLineExcelRow>(
    filePath,
    "remittance_lines",
  );

  const eraByRemittance = new Map<string, string>();
  for (const r of adjRows) {
    const rk = toStr(r.remittance_id);
    const era = toStr(r.era_trace_number);
    if (rk && era && !eraByRemittance.has(rk)) eraByRemittance.set(rk, era);
  }

  const uniqueRemittanceKeys = new Set<string>();
  for (const r of adjRows) {
    const k = toStr(r.remittance_id);
    if (k) uniqueRemittanceKeys.add(k);
  }
  for (const r of lineRows) {
    const k = toStr(r.remittance_id);
    if (k) uniqueRemittanceKeys.add(k);
  }

  for (const remittanceKey of uniqueRemittanceKeys) {
    if (!remittanceKey) continue;
    const era = eraByRemittance.get(remittanceKey);
    await prisma.remittance835.upsert({
      where: {
        tenantId_remittanceKey: { tenantId, remittanceKey },
      },
      create: {
        tenantId,
        remittanceKey,
        eraTraceNumber: era || null,
        source: "excel_synthetic",
        metadata: {},
      },
      update: {
        eraTraceNumber: era || null,
      },
    });
  }

  const remittancePkByKey = new Map<string, string>();
  const remits = await prisma.remittance835.findMany({
    where: { tenantId },
    select: { id: true, remittanceKey: true },
  });
  for (const x of remits) remittancePkByKey.set(x.remittanceKey, x.id);

  let adjOk = 0;
  let adjSkip = 0;
  for (const r of adjRows) {
    if (!toStr(r.adjudication_id)) {
      adjSkip++;
      continue;
    }
    const claimNum = toStr(r.claim_id);
    const remKey = toStr(r.remittance_id);
    const r835 = remittancePkByKey.get(remKey);
    if (!r835) {
      adjSkip++;
      continue;
    }
    const claim = await prisma.claim.findFirst({
      where: { tenantId, claimNumber: claimNum },
    });
    if (!claim) {
      adjSkip++;
      continue;
    }

    const data = adjudicationUpsertData(r, r835, claim.id, tenantId);
    await prisma.claimAdjudication.upsert({
      where: {
        tenantId_adjudicationKey: {
          tenantId,
          adjudicationKey: data.adjudicationKey,
        },
      },
      create: data,
      update: {
        remittance835Id: data.remittance835Id,
        claimId: data.claimId,
        encounterKey: data.encounterKey,
        patientKey: data.patientKey,
        providerKey: data.providerKey,
        payerName: data.payerName,
        insuranceType: data.insuranceType,
        claimSubmissionDate: data.claimSubmissionDate,
        adjudicationDate: data.adjudicationDate,
        paidDate: data.paidDate,
        adjudicationPhase: data.adjudicationPhase,
        claimStatusAtAdjudication: data.claimStatusAtAdjudication,
        payerClaimControlNumber: data.payerClaimControlNumber,
        allowedCents: data.allowedCents,
        paidCents: data.paidCents,
        patientResponsibilityCents: data.patientResponsibilityCents,
        deductibleCents: data.deductibleCents,
        copayCents: data.copayCents,
        coinsuranceCents: data.coinsuranceCents,
        adjustmentCents: data.adjustmentCents,
        denialCategory: data.denialCategory,
        finalizedFlag: data.finalizedFlag,
        appealEligibleFlag: data.appealEligibleFlag,
      },
    });
    adjOk++;
  }

  const adjPkByKey = new Map<string, string>();
  const allAdj = await prisma.claimAdjudication.findMany({
    where: { tenantId },
    select: { id: true, adjudicationKey: true },
  });
  for (const a of allAdj) adjPkByKey.set(a.adjudicationKey, a.id);

  let lnOk = 0;
  let lnSkip = 0;
  for (const r of lineRows) {
    const adjKey = toStr(r.adjudication_id);
    const adjPk = adjPkByKey.get(adjKey);
    if (!adjPk) {
      lnSkip++;
      continue;
    }
    const lineKey = toStr(r.remittance_line_id);
    if (!lineKey) {
      lnSkip++;
      continue;
    }
    const proc = r.procedure_code != null ? toStr(r.procedure_code) : null;

    const lineData = {
      tenantId,
      claimAdjudicationId: adjPk,
      remittanceLineKey: lineKey,
      claimLineKey: toStr(r.claim_line_id) || null,
      encounterKey: toStr(r.encounter_id) || null,
      patientKey: r.patient_id != null ? toStr(r.patient_id) : null,
      providerKey: toStr(r.provider_id) || null,
      adjudicationDate: parseOptionalDate(r.adjudication_date),
      paidDate: parseOptionalDate(r.paid_date),
      procedureCode: proc,
      procedureDescription: toStr(r.procedure_description) || null,
      lineBilledCents: dollarsToCents(r.line_billed_amount ?? 0),
      lineAllowedCents: dollarsToCents(r.line_allowed_amount ?? 0),
      linePaidCents: dollarsToCents(r.line_paid_amount ?? 0),
      patientResponsibilityCents: dollarsToCents(
        r.patient_responsibility_amount ?? 0,
      ),
      adjustmentCents: dollarsToCents(r.adjustment_amount ?? 0),
      carcCode: toStr(r.carc_code) || null,
      carcDescription: toStr(r.carc_description) || null,
      rarcCode: toStr(r.rarc_code) || null,
      rarcDescription: toStr(r.rarc_description) || null,
      lineAdjudicationStatus: toStr(r.line_adjudication_status) || null,
      denialCategory: toStr(r.denial_category) || null,
      extra: {},
    };

    await prisma.remittanceAdjudicationLine.upsert({
      where: {
        tenantId_remittanceLineKey: {
          tenantId,
          remittanceLineKey: lineKey,
        },
      },
      create: lineData,
      update: {
        claimAdjudicationId: lineData.claimAdjudicationId,
        claimLineKey: lineData.claimLineKey,
        encounterKey: lineData.encounterKey,
        patientKey: lineData.patientKey,
        providerKey: lineData.providerKey,
        adjudicationDate: lineData.adjudicationDate,
        paidDate: lineData.paidDate,
        procedureCode: lineData.procedureCode,
        procedureDescription: lineData.procedureDescription,
        lineBilledCents: lineData.lineBilledCents,
        lineAllowedCents: lineData.lineAllowedCents,
        linePaidCents: lineData.linePaidCents,
        patientResponsibilityCents: lineData.patientResponsibilityCents,
        adjustmentCents: lineData.adjustmentCents,
        carcCode: lineData.carcCode,
        carcDescription: lineData.carcDescription,
        rarcCode: lineData.rarcCode,
        rarcDescription: lineData.rarcDescription,
        lineAdjudicationStatus: lineData.lineAdjudicationStatus,
        denialCategory: lineData.denialCategory,
      },
    });
    lnOk++;
  }

  console.log(
    `Remittance: claim adjudications upserted ${adjOk}, skipped ${adjSkip} (missing claim or remittance header); line rows ${lnOk}, skipped ${lnSkip}.`,
  );
}

async function runEnrichOnlyImport(tenantSlug: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    throw new Error(
      `Tenant "${tenantSlug}" not found. Run a full import first or check IMPORT_TENANT_SLUG.`,
    );
  }
  const demoPath = resolveDemographicsPath();
  const remitPath = resolveRemittancePath();
  if (!demoPath && !remitPath) {
    throw new Error(
      "Enrich-only: set REALISTIC_PATIENT_DEMOGRAPHICS_XLSX / REALISTIC_REMITTANCE_XLSX or place patient_demographics_realistic.xlsx and remittance_adjudication_realistic.xlsx in Downloads.",
    );
  }
  if (demoPath) await importPatientDemographics(tenant.id, demoPath);
  if (remitPath) await importRemittanceAdjudication(tenant.id, remitPath);
  console.log(
    `Enrich-only complete for tenant ${tenantSlug}.`,
  );
}

async function main() {
  const replace = argFlag("--replace");
  const enrichOnly = argFlag("--enrich-only");
  const tenantSlug =
    process.env.IMPORT_TENANT_SLUG?.trim() ||
    process.argv.find((a) => a.startsWith("--tenant="))?.slice("--tenant=".length) ||
    "synthetic-test";

  if (enrichOnly) {
    if (replace) {
      throw new Error("Do not combine --enrich-only with --replace.");
    }
    await runEnrichOnlyImport(tenantSlug);
    return;
  }

  const claimsPath =
    process.env.REALISTIC_CLAIMS_XLSX?.trim() ||
    (fs.existsSync(DEFAULT_CLAIMS) ? DEFAULT_CLAIMS : "");
  const encPath =
    process.env.REALISTIC_ENCOUNTERS_XLSX?.trim() ||
    (fs.existsSync(DEFAULT_ENCOUNTERS) ? DEFAULT_ENCOUNTERS : "");
  const linesPath =
    process.env.REALISTIC_LINES_XLSX?.trim() ||
    (fs.existsSync(DEFAULT_LINES) ? DEFAULT_LINES : "");

  if (!claimsPath || !encPath || !linesPath) {
    throw new Error(
      "Set REALISTIC_CLAIMS_XLSX, REALISTIC_ENCOUNTERS_XLSX, REALISTIC_LINES_XLSX or place files in %USERPROFILE%\\Downloads\\",
    );
  }

  console.log("Reading workbooks…");
  const claimRows = readSheetRows<ClaimRow>(claimsPath, "claims_headers");
  const encounterRows = readSheetRows<EncounterRow>(encPath, "ehr_encounters");
  const lineRows = readSheetRows<LineRow>(linesPath, "claim_lines");

  const encByEncId = new Map(
    encounterRows.map((r) => [toStr(r.encounter_id), r]),
  );
  const linesByClaimId = new Map<string, LineRow[]>();
  for (const ln of lineRows) {
    const cid = toStr(ln.claim_id);
    const arr = linesByClaimId.get(cid) ?? [];
    arr.push(ln);
    linesByClaimId.set(cid, arr);
  }
  for (const arr of Array.from(linesByClaimId.values())) {
    arr.sort(
      (a, b) => Number(a.line_number || 0) - Number(b.line_number || 0),
    );
  }

  let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    const display =
      tenantSlug === "synthetic-test"
        ? "Synthetic RCM (Excel import)"
        : `Import tenant (${tenantSlug})`;
    const created = await prisma.tenant.create({
      data: {
        slug: tenantSlug,
        name: display,
        displayName: display,
        primaryColor: "#0f766e",
      },
    });
    tenant = created;
    const all = Object.values(ModuleKey);
    await prisma.moduleEntitlement.createMany({
      data: all.map((module) => ({
        tenantId: created.id,
        module,
        enabled: true,
      })),
    });
    console.log(`Created tenant ${tenantSlug} with all modules enabled.`);
  }

  if (!tenant) {
    throw new Error(`Could not load or create tenant "${tenantSlug}".`);
  }

  if (replace) {
    console.log(`Replace mode: clearing prior data for tenant ${tenantSlug}…`);
    await wipeTenantScopedData(tenant.id);
  } else {
    const existing = await prisma.patient.count({ where: { tenantId: tenant.id } });
    if (existing > 0) {
      throw new Error(
        `Tenant "${tenantSlug}" already has patients. Re-run with --replace to wipe imported clinical/financial rows for that tenant, or use IMPORT_TENANT_SLUG=another-slug.`,
      );
    }
  }

  const tenantId = tenant.id;

  const patientKeyToId = new Map<string, string>();
  const uniquePatientKeys = Array.from(
    new Set(claimRows.map((c) => toStr(c.patient_id))),
  ).filter(Boolean);

  console.log(`Creating ${uniquePatientKeys.length} patients…`);
  for (const pk of uniquePatientKeys) {
    const suffix = pk.slice(-6);
    const patient = await prisma.patient.create({
      data: {
        tenantId,
        mrn: `syn-${pk}`,
        firstName: "Synthetic",
        lastName: `Patient-${suffix}`,
        dob: null,
      },
    });
    patientKeyToId.set(pk, patient.id);
    await prisma.externalIdentifier.create({
      data: {
        tenantId,
        resourceType: CanonicalResourceType.PATIENT,
        resourceId: patient.id,
        system: "synthetic.patient_id",
        value: pk,
      },
    });
  }

  const encounterKeyToId = new Map<string, string>();
  const coverageKeys = new Set<string>();
  console.log(`Creating ${encounterRows.length} encounters (+ coverage)…`);
  for (const er of encounterRows) {
    const eid = toStr(er.encounter_id);
    const pk = toStr(er.patient_id);
    const patientId = patientKeyToId.get(pk);
    if (!patientId) continue;

    const dos = er.date_of_service instanceof Date
      ? er.date_of_service
      : new Date(String(er.date_of_service));

    const parts = [
      toStr(er.chief_complaint),
      toStr(er.history_present_illness),
      toStr(er.assessment_summary),
    ].filter(Boolean);
    const visitSummary =
      parts.join("\n\n").slice(0, 48_000) ||
      "Imported encounter — see synthetic EHR columns for detail.";

    const enc = await prisma.encounter.create({
      data: {
        tenantId,
        patientId,
        dateOfService: dos,
        chiefComplaint: toStr(er.chief_complaint) || null,
        visitSummary,
      },
    });
    encounterKeyToId.set(eid, enc.id);

    await prisma.externalIdentifier.create({
      data: {
        tenantId,
        resourceType: CanonicalResourceType.ENCOUNTER,
        resourceId: enc.id,
        system: "synthetic.encounter_id",
        value: eid,
      },
    });

    const payer = toStr(er.payer_name) || "Unknown payer";
    const covKey = `${patientId}|${payer}|primary`;
    if (!coverageKeys.has(covKey)) {
      coverageKeys.add(covKey);
      await prisma.coverage.create({
        data: {
          tenantId,
          patientId,
          payerName: payer,
          memberId: null,
          planName: toStr(er.insurance_type) || null,
          priority: "primary",
          status: "active",
          rawMetadata: {
            source: "excel_import",
            insurance_type: toStr(er.insurance_type),
          },
        },
      });
    }
  }

  console.log("Creating claim drafts + lines…");
  for (const cr of claimRows) {
    const eid = toStr(cr.encounter_id);
    const encId = encounterKeyToId.get(eid);
    if (!encId) continue;

    const encRow = encByEncId.get(eid);
    const icd10 =
      toStr(encRow?.primary_diagnosis_code) || "Z00.00";

    const draft = await prisma.claimDraft.create({
      data: {
        tenantId,
        encounterId: encId,
        status: "draft",
      },
    });

    const lines = linesByClaimId.get(toStr(cr.claim_id)) ?? [];
    if (lines.length === 0) {
      const fallbackCpt = String(encRow?.procedure_code ?? "99213");
      await prisma.claimDraftLine.create({
        data: {
          draftId: draft.id,
          cpt: fallbackCpt.replace(/\D/g, "").slice(0, 5) || "99213",
          icd10,
          modifier: null,
          units: 1,
          chargeCents: dollarsToCents(cr.billed_amount),
          aiRationale: "Imported from synthetic claim header (no lines row).",
          lineSource: "IMPORTED",
        },
      });
    } else {
      for (const ln of lines) {
        const modA = toStr(ln.modifier_1);
        const modB = toStr(ln.modifier_2);
        const modifier =
          [modA, modB].filter(Boolean).join(",") || null;
        const cptRaw = String(ln.procedure_code ?? "");
        const cpt = cptRaw.replace(/\D/g, "").slice(0, 5) || "99213";
        await prisma.claimDraftLine.create({
          data: {
            draftId: draft.id,
            cpt,
            icd10,
            modifier,
            units: Math.max(1, Math.round(Number(ln.units) || 1)),
            chargeCents: dollarsToCents(ln.line_billed_amount),
            aiRationale:
              toStr(ln.procedure_description) ||
              "Imported procedure line from synthetic workbook.",
            lineSource: ClaimDraftLineSource.IMPORTED,
          },
        });
      }
    }
  }

  console.log("Creating claims, timelines, statements…");
  for (const cr of claimRows) {
    const pk = toStr(cr.patient_id);
    const patientId = patientKeyToId.get(pk);
    if (!patientId) continue;

    const billed = dollarsToCents(cr.billed_amount);
    const paid = dollarsToCents(cr.paid_amount ?? 0);
    const dos = cr.date_of_service instanceof Date
      ? cr.date_of_service
      : new Date(String(cr.date_of_service));
    const status = parseClaimLifecycleStatus(toStr(cr.claim_status));
    const claimNum = toStr(cr.claim_id);

    const paidCentsResolved =
      paid > 0
        ? paid
        : status === ClaimLifecycleStatus.PAID
          ? billed
          : null;

    const claim = await prisma.claim.create({
      data: {
        tenantId,
        patientId,
        claimNumber: claimNum,
        status,
        payerName: toStr(cr.payer_name) || null,
        billedCents: billed,
        paidCents: paidCentsResolved,
        denialReason:
          status === ClaimLifecycleStatus.DENIED
            ? toStr(cr.reason_code) || null
            : null,
        submittedAt: dos,
      },
    });

    await prisma.externalIdentifier.create({
      data: {
        tenantId,
        resourceType: CanonicalResourceType.CLAIM,
        resourceId: claim.id,
        system: "synthetic.claim_id",
        value: claimNum,
      },
    });

    await prisma.claimTimelineEvent.createMany({
      data: [
        {
          claimId: claim.id,
          label: "Imported (synthetic dataset)",
          detail: `Workbook status: ${toStr(cr.claim_status)}`,
          at: dos,
        },
        {
          claimId: claim.id,
          label: "Outcome (spreadsheet)",
          detail: toStr(cr.outcome) || undefined,
          at: new Date(dos.getTime() + 86_400_000),
        },
      ],
    });

    const encId = encounterKeyToId.get(toStr(cr.encounter_id));
    const outcomeStr = toStr(cr.outcome) || "open";
    const stmtStatus = statementStatusFromOutcome(outcomeStr);
    const bal = balanceCentsForStatement(
      outcomeStr,
      billed,
      paidCentsResolved,
    );
    const due = new Date(dos.getTime() + 30 * 86_400_000);

    const stmt = await prisma.statement.create({
      data: {
        tenantId,
        patientId,
        encounterId: encId ?? null,
        number: `STMT-${claimNum}`,
        totalCents: billed,
        balanceCents: bal,
        status: stmtStatus,
        dueDate: due,
      },
    });

    const stLines = linesByClaimId.get(claimNum) ?? [];
    if (stLines.length === 0) {
      await prisma.statementLine.create({
        data: {
          statementId: stmt.id,
          code: "SERVICES",
          description: "Imported balance from claim header",
          amountCents: billed,
        },
      });
    } else {
      for (const ln of stLines) {
        await prisma.statementLine.create({
          data: {
            statementId: stmt.id,
            code: String(ln.procedure_code ?? "UNK"),
            description:
              toStr(ln.procedure_description) || "Service line",
            amountCents: dollarsToCents(ln.line_billed_amount),
          },
        });
      }
    }

    if (stmtStatus === "partially_paid") {
      const payAmt = Math.min(
        Math.round(billed * 0.45),
        Math.max(0, billed - bal),
      );
      if (payAmt > 0) {
        await prisma.payment.create({
          data: {
            tenantId,
            statementId: stmt.id,
            amountCents: payAmt,
            status: "posted",
            method: "card",
            paidAt: new Date(due.getTime() - 5 * 86_400_000),
          },
        });
      }
    }
  }

  const demoPath = resolveDemographicsPath();
  const remitPath = resolveRemittancePath();
  if (demoPath) {
    await importPatientDemographics(tenantId, demoPath);
  } else {
    console.log(
      "Skipping demographics workbook (set REALISTIC_PATIENT_DEMOGRAPHICS_XLSX or add patient_demographics_realistic.xlsx to Downloads).",
    );
  }
  if (remitPath) {
    await importRemittanceAdjudication(tenantId, remitPath);
  } else {
    console.log(
      "Skipping remittance workbook (set REALISTIC_REMITTANCE_XLSX or add remittance_adjudication_realistic.xlsx to Downloads).",
    );
  }

  console.log(
    `Done. Tenant slug: ${tenantSlug} — open /o/${tenantSlug}/… after granting your user a Membership (super-admin) or sign-in user with access.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

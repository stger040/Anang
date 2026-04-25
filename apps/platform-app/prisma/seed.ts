import {
  PrismaClient,
  ModuleKey,
  AppRole,
  ClaimLifecycleStatus,
  ClaimIssueSource,
  ClaimDraftLineSource,
  PriorAuthChecklistStatus,
  PriorAuthServiceCodeType,
  PriorAuthStatus,
  PriorAuthSubmissionMethod,
  PriorAuthUrgency,
} from "@prisma/client";

import { defaultPriorAuthImplementationSettings } from "../src/lib/prior-auth/defaults";

const prisma = new PrismaClient();

const TENANT_SLUG = "synthetic-test";

/** One end-to-end demo: professional claim billed → payer paid portion → patient statement for remainder. */
const BILL_CENTS = 285_00; // $285.00 — 99214 established office visit
const INSURANCE_PAID_CENTS = 165_00; // payer allowed + paid (combined demo)
const PATIENT_RESPONSIBILITY_CENTS = BILL_CENTS - INSURANCE_PAID_CENTS; // $120.00 PR

function allModules(): ModuleKey[] {
  return [
    ModuleKey.CORE,
    ModuleKey.BUILD,
    ModuleKey.PAY,
    ModuleKey.CONNECT,
    ModuleKey.INSIGHT,
    ModuleKey.SUPPORT,
    ModuleKey.COVER,
  ];
}

async function main() {
  await prisma.externalIdentifier.deleteMany();
  await prisma.sourceArtifact.deleteMany();
  await prisma.ingestionBatch.deleteMany();
  await prisma.buildRulePack.deleteMany();
  await prisma.buildDraftEvent.deleteMany();
  await prisma.buildKnowledgeChunk.deleteMany();
  await prisma.supportTask.deleteMany();
  await prisma.coverAssistanceCase.deleteMany();
  await prisma.priorAuthStatusPoll.deleteMany();
  await prisma.priorAuthEvent.deleteMany();
  await prisma.priorAuthAttachment.deleteMany();
  await prisma.priorAuthChecklistItem.deleteMany();
  await prisma.priorAuthService.deleteMany();
  await prisma.priorAuthCase.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.claimTimelineEvent.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.statementLine.deleteMany();
  await prisma.statement.deleteMany();
  await prisma.coverage.deleteMany();
  await prisma.claimIssue.deleteMany();
  await prisma.claimDraftLine.deleteMany();
  await prisma.claimDraft.deleteMany();
  await prisma.encounter.deleteMany();
  await prisma.patientPortalIdentity.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.moduleEntitlement.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const userSuper = await prisma.user.create({
    data: {
      email: "rick@anang.ai",
      name: "Rick (Super Admin)",
      appRole: AppRole.SUPER_ADMIN,
    },
  });

  const userStaff = await prisma.user.create({
    data: {
      email: "rick@stginnovation.com",
      name: "Rick (Staff)",
      appRole: AppRole.STAFF,
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      slug: TENANT_SLUG,
      name: "Synthetic-test",
      displayName: "Synthetic-test",
      primaryColor: "#13264C",
      settings: {
        timezone: "America/Chicago",
        environment: "synthetic",
        implementation: {
          version: 1,
          checklist: { billing: {}, it: {} },
          priorAuth: defaultPriorAuthImplementationSettings(),
        },
      },
    },
  });

  const mods = allModules();
  for (const m of mods) {
    await prisma.moduleEntitlement.create({
      data: { tenantId: tenant.id, module: m, enabled: true },
    });
  }
  for (const m of Object.values(ModuleKey)) {
    if (!mods.includes(m)) {
      await prisma.moduleEntitlement.create({
        data: { tenantId: tenant.id, module: m, enabled: false },
      });
    }
  }

  await prisma.membership.createMany({
    data: [
      {
        userId: userSuper.id,
        tenantId: tenant.id,
        role: AppRole.TENANT_ADMIN,
      },
      {
        userId: userStaff.id,
        tenantId: tenant.id,
        role: AppRole.STAFF,
      },
    ],
  });

  await prisma.buildKnowledgeChunk.createMany({
    data: [
      {
        tenantId: tenant.id,
        kind: "cpt",
        lookupKey: "99214",
        title: "CPT 99214 — Office/outpatient visit, established patient",
        body: "Moderate level MDM or 30–39 minutes total time; common primary-care visit. Pair with accurate POS and payer-specific bundling rules.",
        sourceLabel: "Seed · education only",
      },
      {
        tenantId: tenant.id,
        kind: "icd10",
        lookupKey: "I10",
        title: "ICD-10-CM I10 — Essential (primary) hypertension",
        body: "Often supporting E/M when documented as active problem addressed this visit; payer policy still governs medical necessity.",
        sourceLabel: "Seed · education only",
      },
    ],
    skipDuplicates: true,
  });

  // --- Single patient drives Build → Connect → Pay → Support → Cover ---
  const patientSam = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      mrn: "SYN-1001",
      firstName: "Sam",
      lastName: "TestPatient",
      dob: new Date("1990-06-15"),
      email: "stger040@gmail.com",
      phone: "+10000000000",
    },
  });

  const coverageSam = await prisma.coverage.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      payerName: "Demo Health Plan",
      memberId: "DHP-M-77821",
      planName: "Open Access PPO",
      priority: "primary",
      subscriberRel: "self",
      status: "active",
      effectiveFrom: new Date("2025-01-01"),
    },
  });

  const encounterDos = new Date("2026-03-18T15:30:00.000Z");
  const draftApprovedAt = new Date(encounterDos.getTime() + 86400000);
  const claim837SubmittedAt = new Date(encounterDos.getTime() + 86400000 * 2);
  const claim277AcceptedAt = new Date(claim837SubmittedAt.getTime() + 4 * 3600000);
  const claim835AdjudicatedAt = new Date(claim837SubmittedAt.getTime() + 86400000 * 3);
  const claimInsurancePaidAt = new Date(claim835AdjudicatedAt.getTime() + 2 * 3600000);
  const statementDue = new Date(claimInsurancePaidAt.getTime() + 86400000 * 14);

  const encounter = await prisma.encounter.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      dateOfService: encounterDos,
      placeOfService: "11",
      chiefComplaint: "Annual wellness with blood pressure follow-up",
      visitSummary:
        "Established patient seen for scheduled follow-up. Vitals stable. Assessment: hypertension monitored on current meds. Plan: continue lisinopril, return PRN. (Synthetic seed — one visit tied to draft → claim → statement.)",
      reviewStatus: "approved",
    },
  });

  const draft = await prisma.claimDraft.create({
    data: {
      tenantId: tenant.id,
      encounterId: encounter.id,
      status: "submitted_mock",
      approvedAt: draftApprovedAt,
      approvedById: userStaff.id,
    },
  });

  await prisma.claimDraftLine.createMany({
    data: [
      {
        draftId: draft.id,
        cpt: "99214",
        cptDescriptor: "Office visit, established patient, moderate MDM",
        icd10: "I10",
        icd10Descriptor: "Essential (primary) hypertension",
        units: 1,
        chargeCents: BILL_CENTS,
        aiRationale:
          "Seed line — professional charge aligned with Connect claim and Pay statement PR.",
        lineSource: ClaimDraftLineSource.IMPORTED,
      },
    ],
  });

  await prisma.claimIssue.create({
    data: {
      draftId: draft.id,
      severity: "info",
      category: "documentation",
      title: "Pre-submit checklist cleared",
      detail:
        "Synthetic seed: POS 11 office, payer Demo Health Plan, single E/M line — ready for mock submit.",
      explainability: "Demo narrative only.",
      issueSource: ClaimIssueSource.SEED,
      ruleKey: "seed.lifecycle.ready",
      citations: [],
    },
  });

  const claimNumber = "ST-SYN-2026-00042";

  const claim = await prisma.claim.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      encounterId: encounter.id,
      claimDraftId: draft.id,
      claimNumber,
      status: ClaimLifecycleStatus.PAID,
      payerName: "Demo Health Plan",
      billedCents: BILL_CENTS,
      paidCents: INSURANCE_PAID_CENTS,
      submittedAt: claim837SubmittedAt,
      ediRefs: {
        syntheticLifecycle: true,
        encounterId: encounter.id,
        claimDraftId: draft.id,
      },
    },
  });

  const paChecklist = [
    { label: "Clinical documentation complete", sortOrder: 0 },
    { label: "Procedure / diagnosis codes confirmed", sortOrder: 1 },
    { label: "Payer / plan verified for medical benefit", sortOrder: 2 },
    {
      label: "Submission packet assembled (no auto-submit)",
      sortOrder: 3,
    },
  ] as const;

  const paChecklistCreates = paChecklist.map((c) => ({
    label: c.label,
    sortOrder: c.sortOrder,
    status: PriorAuthChecklistStatus.PENDING,
  }));

  await prisma.priorAuthCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      caseNumber: "PA-2026-SEED-0001",
      status: PriorAuthStatus.DRAFT,
      urgency: PriorAuthUrgency.ROUTINE,
      priority: "normal",
      source: "seed",
      submissionMethod: PriorAuthSubmissionMethod.NOT_SUBMITTED,
      payerName: "Demo Health Plan",
      payerPlanName: "Open Access PPO",
      coverageId: coverageSam.id,
      scheduledAt: new Date(Date.now() + 2 * 86400000),
      checklistItems: { create: [...paChecklistCreates] },
      services: {
        create: {
          codeType: PriorAuthServiceCodeType.CPT,
          code: "72148",
          description: "MRI lumbar spine without contrast",
          units: 1,
          sortOrder: 0,
        },
      },
    },
  });

  await prisma.priorAuthCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      encounterId: encounter.id,
      caseNumber: "PA-2026-SEED-0002",
      status: PriorAuthStatus.IN_REVIEW,
      urgency: PriorAuthUrgency.ROUTINE,
      priority: "high",
      source: "seed",
      submissionMethod: PriorAuthSubmissionMethod.PORTAL,
      payerName: "Demo Health Plan",
      payerPlanName: "Open Access PPO",
      coverageId: coverageSam.id,
      submittedAt: new Date(Date.now() - 3 * 86400000),
      dueAt: new Date(Date.now() + 10 * 86400000),
      checklistItems: { create: [...paChecklistCreates] },
      services: {
        create: {
          codeType: PriorAuthServiceCodeType.CPT,
          code: "73721",
          description: "MRI joint upper extremity w/o contrast",
          units: 1,
          sortOrder: 0,
        },
      },
    },
  });

  await prisma.priorAuthCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      encounterId: encounter.id,
      claimId: claim.id,
      caseNumber: "PA-2026-SEED-0003",
      status: PriorAuthStatus.APPROVED,
      urgency: PriorAuthUrgency.ROUTINE,
      priority: "normal",
      source: "seed",
      submissionMethod: PriorAuthSubmissionMethod.PORTAL,
      payerName: "Demo Health Plan",
      payerPlanName: "Open Access PPO",
      coverageId: coverageSam.id,
      authorizationNumber: "DHP-AUTH-SEED-9901",
      submittedAt: new Date(Date.now() - 20 * 86400000),
      decisionAt: new Date(Date.now() - 18 * 86400000),
      expiresAt: new Date(Date.now() + 25 * 86400000),
      checklistItems: { create: [...paChecklistCreates] },
      services: {
        create: {
          codeType: PriorAuthServiceCodeType.CPT,
          code: "99214",
          description: "Office visit, established patient",
          units: 1,
          sortOrder: 0,
        },
      },
    },
  });

  await prisma.priorAuthCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      encounterId: encounter.id,
      caseNumber: "PA-2026-SEED-0004",
      status: PriorAuthStatus.DENIED,
      urgency: PriorAuthUrgency.ROUTINE,
      priority: "high",
      source: "seed",
      submissionMethod: PriorAuthSubmissionMethod.FAX,
      payerName: "Demo Health Plan",
      payerPlanName: "Open Access PPO",
      coverageId: coverageSam.id,
      submittedAt: new Date(Date.now() - 30 * 86400000),
      decisionAt: new Date(Date.now() - 28 * 86400000),
      payerDecision: {
        summary: "Insufficient clinical for medical necessity",
        nextStep: "Gather operative report and resubmit",
      },
      reworkMetrics: { resubmissionCount: 0, denialReason: "missing_documentation" },
      checklistItems: { create: [...paChecklistCreates] },
      services: {
        create: {
          codeType: PriorAuthServiceCodeType.CPT,
          code: "29881",
          description: "Knee arthroscopy",
          units: 1,
          sortOrder: 0,
        },
      },
    },
  });

  await prisma.claimTimelineEvent.createMany({
    data: [
      {
        claimId: claim.id,
        at: draftApprovedAt,
        label: "Draft approved in Build",
        detail: `Claim draft submitted for billing after encounter review (draft ${draft.id.slice(0, 8)}…).`,
      },
      {
        claimId: claim.id,
        at: claim837SubmittedAt,
        label: "837P submitted to clearinghouse",
        detail: "Professional claim transmitted (synthetic milestone).",
      },
      {
        claimId: claim.id,
        at: claim277AcceptedAt,
        label: "277CA — claim accepted",
        detail: "Functional acknowledgment received from payer path (demo).",
      },
      {
        claimId: claim.id,
        at: claim835AdjudicatedAt,
        label: "835 ERA adjudicated",
        detail: "Remittance advice processed; allowed amount and PR derived (demo).",
      },
      {
        claimId: claim.id,
        at: claimInsurancePaidAt,
        label: "Insurance payment posted",
        detail: `Payer payment applied: $${(INSURANCE_PAID_CENTS / 100).toFixed(2)} toward billed $${(BILL_CENTS / 100).toFixed(2)}.`,
      },
    ],
  });

  const statementNumber = "STMT-SYN-2026-0042";

  const statement = await prisma.statement.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      encounterId: encounter.id,
      claimId: claim.id,
      number: statementNumber,
      totalCents: PATIENT_RESPONSIBILITY_CENTS,
      balanceCents: PATIENT_RESPONSIBILITY_CENTS,
      status: "open",
      dueDate: statementDue,
    },
  });

  await prisma.statementLine.createMany({
    data: [
      {
        statementId: statement.id,
        code: "Coinsurance",
        description: "Plan coinsurance after payer allowed amount (99214 visit)",
        amountCents: 7200,
      },
      {
        statementId: statement.id,
        code: "Copay",
        description: "Specialist / PCP copay per benefit design (visit dated Mar 18, 2026)",
        amountCents: 4800,
      },
    ],
  });

  await prisma.supportTask.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      statementId: statement.id,
      title: "Patient called about coinsurance on new statement",
      detail: `Question on ${statementNumber} lines after 835 posted for claim ${claimNumber}.`,
      status: "open",
      priority: "normal",
      category: "billing_question",
    },
  });

  await prisma.coverAssistanceCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientSam.id,
      track: "financial_assistance",
      status: "in_review",
      householdSize: 2,
      annualIncomeCents: 41_000_00,
      notes: `Same episode as ${statementNumber}: patient requested assistance review after receiving patient responsibility.`,
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorUserId: userSuper.id,
        action: "tenant.seed.completed",
        resource: "tenant",
        metadata: {
          slug: TENANT_SLUG,
          lifecycle: "single_patient_build_connect_pay",
          claimNumber,
          statementNumber,
        },
      },
      {
        tenantId: null,
        actorUserId: userSuper.id,
        action: "superadmin.login",
        resource: "platform",
        metadata: {},
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log("Seed complete.", {
    tenant: TENANT_SLUG,
    users: [userSuper.email, userStaff.email],
    patientPortalEmail: patientSam.email,
    demoClaim: claimNumber,
    demoStatement: statementNumber,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

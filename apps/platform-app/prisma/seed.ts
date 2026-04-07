import {
  PrismaClient,
  ModuleKey,
  AppRole,
  ClaimLifecycleStatus,
  ClaimIssueSource,
  ClaimDraftLineSource,
} from "@prisma/client";

const prisma = new PrismaClient();

const TENANT_SLUG = "synthetic-test";

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
        lookupKey: "93015",
        title: "CPT 93015 — cardiovascular stress testing",
        body: "Supervised exercise (or pharmacologic) cardiovascular stress testing with ECG. Common payer documentation targets; NCCI may bundle with same-day E/M.",
        sourceLabel: "Seed · education only",
      },
      {
        tenantId: tenant.id,
        kind: "cpt",
        lookupKey: "99214",
        title: "CPT 99214 — office E/M established",
        body: "Moderate MDM or time for established outpatient; often paired with diagnostics on same date — payer rules vary.",
        sourceLabel: "Seed · education only",
      },
    ],
    skipDuplicates: true,
  });

  const patientStaff = await prisma.patient.create({
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

  const patientDemo2 = await prisma.patient.create({
    data: {
      tenantId: tenant.id,
      mrn: "SYN-1002",
      firstName: "Jordan",
      lastName: "Sample",
      dob: new Date("1975-11-02"),
    },
  });

  await prisma.coverage.create({
    data: {
      tenantId: tenant.id,
      patientId: patientStaff.id,
      payerName: "Synthetic Payer",
      memberId: "SYN-M-001",
      planName: "PPO Test",
      priority: "primary",
      subscriberRel: "self",
      status: "active",
      effectiveFrom: new Date("2025-01-01"),
    },
  });

  const encounter = await prisma.encounter.create({
    data: {
      tenantId: tenant.id,
      patientId: patientStaff.id,
      dateOfService: new Date("2026-03-18T14:00:00Z"),
      chiefComplaint: "Synthetic demo visit",
      visitSummary:
        "Synthetic seed encounter for Build / Pay testing — not real clinical data.",
      reviewStatus: "in_review",
    },
  });

  const draft = await prisma.claimDraft.create({
    data: {
      tenantId: tenant.id,
      encounterId: encounter.id,
      status: "draft",
    },
  });

  await prisma.claimDraftLine.createMany({
    data: [
      {
        draftId: draft.id,
        cpt: "99214",
        icd10: "I10",
        units: 1,
        chargeCents: 28500,
        aiRationale: "Seed line — established visit example.",
        lineSource: ClaimDraftLineSource.IMPORTED,
      },
    ],
  });

  await prisma.claimIssue.create({
    data: {
      draftId: draft.id,
      severity: "info",
      category: "coding",
      title: "Seed issue",
      detail: "Documentation reminder for synthetic data.",
      explainability: "Placeholder for UI testing.",
      issueSource: ClaimIssueSource.SEED,
      citations: [],
    },
  });

  const t0 = new Date("2026-03-01T12:00:00Z");
  const claim = await prisma.claim.create({
    data: {
      tenantId: tenant.id,
      patientId: patientStaff.id,
      claimNumber: "CLM-SYN-9001",
      status: ClaimLifecycleStatus.PAID,
      payerName: "Synthetic Payer",
      billedCents: 98000,
      paidCents: 87200,
      submittedAt: new Date(t0.getTime() + 86400000),
    },
  });

  await prisma.claimTimelineEvent.createMany({
    data: [
      { claimId: claim.id, label: "Draft created", at: t0 },
      {
        claimId: claim.id,
        label: "Submitted",
        at: new Date(t0.getTime() + 3600000),
      },
      {
        claimId: claim.id,
        label: "835 posted",
        at: new Date(t0.getTime() + 86400000 * 5),
      },
    ],
  });

  const statement = await prisma.statement.create({
    data: {
      tenantId: tenant.id,
      patientId: patientStaff.id,
      encounterId: encounter.id,
      number: "STMT-SYN-1",
      totalCents: 45000,
      balanceCents: 12000,
      status: "open",
      dueDate: new Date("2026-04-15"),
    },
  });

  await prisma.statementLine.createMany({
    data: [
      {
        statementId: statement.id,
        code: "Coinsurance",
        description: "Synthetic balance — patient responsibility",
        amountCents: 12000,
      },
      {
        statementId: statement.id,
        code: "Copay",
        description: "Specialist copay",
        amountCents: 33000,
      },
    ],
  });

  await prisma.coverAssistanceCase.create({
    data: {
      tenantId: tenant.id,
      patientId: patientDemo2.id,
      track: "financial_assistance",
      status: "in_review",
      notes: "Synthetic Cover queue item.",
    },
  });

  await prisma.supportTask.create({
    data: {
      tenantId: tenant.id,
      patientId: patientStaff.id,
      statementId: statement.id,
      title: "Synthetic support task",
      status: "open",
      priority: "normal",
      category: "billing_question",
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        tenantId: tenant.id,
        actorUserId: userSuper.id,
        action: "tenant.seed.completed",
        resource: "tenant",
        metadata: { slug: TENANT_SLUG },
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
    patientPortalEmail: patientStaff.email,
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

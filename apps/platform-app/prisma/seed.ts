import {
  PrismaClient,
  ModuleKey,
  AppRole,
  ClaimLifecycleStatus,
  ClaimIssueSource,
} from "@prisma/client";

const prisma = new PrismaClient();

function entitlementsForTenant(slug: string): ModuleKey[] {
  if (slug === "lco") {
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
  if (slug === "hayward" || slug === "ashland") {
    // Selective deployment: no Connect / Support / Cover in this pilot-shaped tenant
    return [ModuleKey.CORE, ModuleKey.BUILD, ModuleKey.PAY, ModuleKey.INSIGHT];
  }
  // Pilot tenant (narrow module mix)
  return [ModuleKey.CORE, ModuleKey.PAY, ModuleKey.INSIGHT];
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
      email: "super@anang.internal",
      name: "Anang Super Admin",
      appRole: AppRole.SUPER_ADMIN,
    },
  });

  const userLco = await prisma.user.create({
    data: {
      email: "admin@lco.anang.demo",
      name: "Jordan Lee",
      appRole: AppRole.TENANT_ADMIN,
    },
  });

  const userTamarack = await prisma.user.create({
    data: {
      email: "rcm@tamarack.anang.demo",
      name: "Sam Rivera",
      appRole: AppRole.STAFF,
    },
  });

  const userDemo = await prisma.user.create({
    data: {
      email: "viewer@demo.anang.demo",
      name: "Alex Chen",
      appRole: AppRole.STAFF,
    },
  });

  /** Restricted staff: patient-facing modules only (no Build / Connect / Insight). */
  const userLcoFrontline = await prisma.user.create({
    data: {
      email: "support-frontline@lco.anang.demo",
      name: "Riley Park",
      appRole: AppRole.STAFF,
    },
  });

  const tenantLco = await prisma.tenant.create({
    data: {
      slug: "lco",
      name: "LCO Health Center",
      displayName: "LCO Health Center",
      primaryColor: "#13264C",
      settings: {
        timezone: "America/Chicago",
        emrConnection: "greenway_intergy_pilot",
        implementation: {
          version: 1,
          ehrVendor: "Greenway / Intergy",
          integrationPattern: "FHIR R4 (Greenway Developer Platform)",
          milestoneNotes:
            "Pilot 1 EHR lane — see docs/PILOT_CONNECTOR_ROADMAP.md",
          checklist: { billing: {}, it: {} },
        },
      },
    },
  });

  const tenantTamarackHayward = await prisma.tenant.create({
    data: {
      slug: "hayward",
      name: "Tamarack Health — Hayward",
      displayName: "Tamarack Health",
      primaryColor: "#1d4ed8",
      settings: {
        timezone: "America/Los_Angeles",
        site: "hayward",
        emrConnection: "pending_ehr",
      },
    },
  });

  const tenantTamarackAshland = await prisma.tenant.create({
    data: {
      slug: "ashland",
      name: "Tamarack Health — Ashland",
      displayName: "Tamarack Health",
      primaryColor: "#1d4ed8",
      settings: {
        timezone: "America/Los_Angeles",
        site: "ashland",
        emrConnection: "epic_planned",
        implementation: {
          version: 1,
          ehrVendor: "Epic",
          integrationPattern: "SMART on FHIR / Bulk Data (planned)",
          milestoneNotes:
            "Pilot 2 — Tamarack; docs/EPIC_FHIR_INTEGRATION_PLAN.md",
          checklist: { billing: {}, it: {} },
        },
      },
    },
  });

  const tenantDemo = await prisma.tenant.create({
    data: {
      slug: "demo",
      name: "Pilot Regional Medical Group",
      displayName: "Pilot Regional",
      primaryColor: "#E24E42",
      settings: {
        environment: "staging",
      },
    },
  });

  for (const t of [
    tenantLco,
    tenantTamarackHayward,
    tenantTamarackAshland,
    tenantDemo,
  ]) {
    const mods = entitlementsForTenant(t.slug);
    for (const m of mods) {
      await prisma.moduleEntitlement.create({
        data: { tenantId: t.id, module: m, enabled: true },
      });
    }
    // Record disabled modules explicitly for entitlement audits
    const all = Object.values(ModuleKey);
    for (const m of all) {
      if (!mods.includes(m)) {
        await prisma.moduleEntitlement.create({
          data: { tenantId: t.id, module: m, enabled: false },
        });
      }
    }
  }

  await prisma.membership.createMany({
    data: [
      { userId: userLco.id, tenantId: tenantLco.id, role: AppRole.TENANT_ADMIN },
      {
        userId: userLcoFrontline.id,
        tenantId: tenantLco.id,
        role: AppRole.STAFF,
        staffModuleAllowList: [
          ModuleKey.PAY,
          ModuleKey.COVER,
          ModuleKey.SUPPORT,
        ],
      },
      {
        userId: userTamarack.id,
        tenantId: tenantTamarackHayward.id,
        role: AppRole.STAFF,
      },
      {
        userId: userTamarack.id,
        tenantId: tenantTamarackAshland.id,
        role: AppRole.STAFF,
      },
      { userId: userDemo.id, tenantId: tenantDemo.id, role: AppRole.STAFF },
    ],
  });

  const pilotKnowledgeChunks = (tenantId: string) => [
    {
      tenantId,
      kind: "cpt",
      lookupKey: "93015",
      title: "CPT 93015 — cardiovascular stress testing",
      body: "Often describes supervised exercise (or pharmacologic) cardiovascular stress testing with ECG monitoring. Medical necessity and complete report documentation are common payer targets; NCCI bundling with same-day E/M may apply depending on payer edits.",
      sourceLabel: "Seed · education only",
    },
    {
      tenantId,
      kind: "cpt",
      lookupKey: "99214",
      title: "CPT 99214 — office/outpatient E/M, established patient",
      body: "Office or other outpatient visit for an established patient; moderate level of MDM or time. Frequently paired with diagnostic testing on the same date — payers may require distinct diagnoses or modifiers when multiple services are reported.",
      sourceLabel: "Seed · education only",
    },
    {
      tenantId,
      kind: "icd10",
      lookupKey: "I20.9",
      title: "ICD-10-CM I20.9 — angina pectoris, unspecified",
      body: "Unspecified angina; coders may prefer a more specific angina subtype when documented. Specificity can affect medical necessity narratives for cardiology testing.",
      sourceLabel: "Seed · education only",
    },
    {
      tenantId,
      kind: "icd10",
      lookupKey: "I10",
      title: "ICD-10-CM I10 — essential hypertension",
      body: "Essential (primary) hypertension; common secondary diagnosis in E/M claims. Ensure documentation supports any reported chronic-condition management complexity.",
      sourceLabel: "Seed · education only",
    },
  ];
  for (const tid of [
    tenantLco.id,
    tenantTamarackHayward.id,
    tenantTamarackAshland.id,
  ]) {
    await prisma.buildKnowledgeChunk.createMany({
      data: pilotKnowledgeChunks(tid),
      skipDuplicates: true,
    });
  }

  // --- Patients & Build (LCO + Tamarack) ---
  const patLco1 = await prisma.patient.create({
    data: {
      tenantId: tenantLco.id,
      mrn: "LCO-88421",
      firstName: "Maria",
      lastName: "Santos",
      dob: new Date("1962-03-14"),
    },
  });

  const patLco2 = await prisma.patient.create({
    data: {
      tenantId: tenantLco.id,
      mrn: "LCO-99012",
      firstName: "James",
      lastName: "O’Neill",
      dob: new Date("1978-11-02"),
    },
  });

  const patTam1 = await prisma.patient.create({
    data: {
      tenantId: tenantTamarackHayward.id,
      mrn: "TAM-44102",
      firstName: "Elena",
      lastName: "Vargas",
      dob: new Date("1955-07-21"),
    },
  });

  await prisma.coverage.createMany({
    data: [
      {
        tenantId: tenantLco.id,
        patientId: patLco1.id,
        payerName: "Regional Payer Alliance",
        memberId: "RPA-77881234",
        groupNumber: "GRP-44001",
        planName: "PPO Gold",
        priority: "primary",
        subscriberRel: "self",
        status: "active",
        effectiveFrom: new Date("2025-01-01"),
      },
      {
        tenantId: tenantLco.id,
        patientId: patLco1.id,
        payerName: "Auto Injury Liability (seed)",
        memberId: "AIL-00921",
        planName: "Third-party — demo only",
        priority: "secondary",
        subscriberRel: "self",
        status: "inactive",
        effectiveFrom: new Date("2025-12-01"),
        effectiveTo: new Date("2026-02-01"),
        rawMetadata: { note: "Seed secondary for dual-coverage example" },
      },
      {
        tenantId: tenantLco.id,
        patientId: patLco2.id,
        payerName: "State Medicaid (seed)",
        memberId: "MCO-99201-AA",
        planName: "Managed Medicaid",
        priority: "primary",
        subscriberRel: "self",
        status: "active",
        effectiveFrom: new Date("2024-06-01"),
      },
    ],
  });

  const visitSummaryLco = `Chief complaint: episodic chest tightness on exertion over 2 weeks.
History: HTN, HLD, former smoker (quit 10y). ROS: denies syncope; mild DOE walking >2 blocks.
Exam: BP 138/86, HR 72, lungs clear, no edema. EKG NSR.
Plan: stress test scheduled; continue antihypertensive; counsel on exertion limits.`;

  const encLco1 = await prisma.encounter.create({
    data: {
      tenantId: tenantLco.id,
      patientId: patLco1.id,
      dateOfService: new Date("2026-03-18T14:00:00Z"),
      chiefComplaint: "Chest tightness on exertion",
      visitSummary: visitSummaryLco,
      reviewStatus: "in_review",
    },
  });

  await prisma.encounter.create({
    data: {
      tenantId: tenantLco.id,
      patientId: patLco2.id,
      dateOfService: new Date("2026-03-21T09:30:00Z"),
      chiefComplaint: "Follow-up — T2DM",
      visitSummary:
        "A1c 7.2% — intensify lifestyle; continue metformin; foot exam WNL; retinal screening ordered.",
      reviewStatus: "queued",
    },
  });

  const encTam1 = await prisma.encounter.create({
    data: {
      tenantId: tenantTamarackHayward.id,
      patientId: patTam1.id,
      dateOfService: new Date("2026-03-15T16:45:00Z"),
      chiefComplaint: "ACL reconstruction follow-up",
      visitSummary:
        "PT progressing; full extension; mild effusion; ROM 0–110°. Continue brace wean per protocol.",
      reviewStatus: "queued",
    },
  });

  const draftLco = await prisma.claimDraft.create({
    data: {
      tenantId: tenantLco.id,
      encounterId: encLco1.id,
      status: "draft",
    },
  });

  await prisma.claimDraftLine.createMany({
    data: [
      {
        draftId: draftLco.id,
        cpt: "93015",
        icd10: "I20.9",
        modifier: "59",
        units: 1,
        chargeCents: 42500,
        aiRationale:
          "Documented exertional chest discomfort with cardiac workup planned — exercise stress test (CPT 93015) aligns with indication when combined ECG + stress is performed.",
      },
      {
        draftId: draftLco.id,
        cpt: "99214",
        icd10: "I10",
        modifier: null,
        units: 1,
        chargeCents: 28500,
        aiRationale:
          "Established patient with multiple chronic conditions addressed (HTN, HLD), moderate complexity MDM based on cardiac risk workup and medication management.",
      },
    ],
  });

  await prisma.claimIssue.createMany({
    data: [
      {
        draftId: draftLco.id,
        severity: "critical",
        category: "documentation",
        title: "Stress test report not linked",
        detail:
          "Payer may deny 93015 without finalized stress test interpretation attached to encounter.",
        explainability:
          "Our documentation matcher found plan language referencing a stress test but no signed report artifact in the linked media slot used for cardiology diagnostics.",
        issueSource: ClaimIssueSource.SEED,
        citations: [],
      },
      {
        draftId: draftLco.id,
        severity: "warning",
        category: "denial_risk",
        title: "Modifier 59 pair scrutiny",
        detail:
          "National Correct Coding Initiative (NCCI) edits may apply between E/M and same-day cardiology testing.",
        explainability:
          "When 99214 and 93015 share a date, payers often require distinct diagnoses or APP modifiers; NCCI bundles are frequent in this pairing unless record supports separate, significant service.",
        issueSource: ClaimIssueSource.SEED,
        citations: [],
      },
      {
        draftId: draftLco.id,
        severity: "info",
        category: "coding",
        title: "ICD specificity opportunity",
        detail: "Consider I20.89 vs I20.9 if anginal equivalent is better documented.",
        explainability:
          "Clinical text mentions 'tightness on exertion' without unstable features — coders often prefers specificity when EHR documents angina type.",
        issueSource: ClaimIssueSource.SEED,
        citations: [],
      },
    ],
  });

  await prisma.claimDraft.create({
    data: {
      tenantId: tenantTamarackHayward.id,
      encounterId: encTam1.id,
      status: "draft",
    },
  });

  // --- Connect: claims lifecycle ---
  const mkClaim = async (args: {
    tenantId: string;
    patientId?: string;
    claimNumber: string;
    status: ClaimLifecycleStatus;
    payerName: string;
    billedCents: number;
    paidCents?: number;
    denialReason?: string;
    submittedAt?: Date;
    timeline: { label: string; detail?: string; at: Date }[];
  }) => {
    const c = await prisma.claim.create({
      data: {
        tenantId: args.tenantId,
        patientId: args.patientId,
        claimNumber: args.claimNumber,
        status: args.status,
        payerName: args.payerName,
        billedCents: args.billedCents,
        paidCents: args.paidCents,
        denialReason: args.denialReason,
        submittedAt: args.submittedAt,
      },
    });
    for (const e of args.timeline) {
      await prisma.claimTimelineEvent.create({
        data: {
          claimId: c.id,
          label: e.label,
          detail: e.detail,
          at: e.at,
        },
      });
    }
    return c;
  };

  const t0 = new Date("2026-03-01T12:00:00Z");
  await mkClaim({
    tenantId: tenantLco.id,
    patientId: patLco1.id,
    claimNumber: "CLM-LCO-9001",
    status: ClaimLifecycleStatus.PAID,
    payerName: "Regional Payer Alliance",
    billedCents: 98000,
    paidCents: 87200,
    submittedAt: new Date(t0.getTime() + 86400000),
    timeline: [
      { label: "Draft created", at: new Date(t0.getTime()) },
      { label: "Submitted to payer", at: new Date(t0.getTime() + 3600000) },
      { label: "277CA accepted", at: new Date(t0.getTime() + 86400000) },
      { label: "835 remittance posted", at: new Date(t0.getTime() + 86400000 * 10) },
    ],
  });

  await mkClaim({
    tenantId: tenantLco.id,
    patientId: patLco2.id,
    claimNumber: "CLM-LCO-9002",
    status: ClaimLifecycleStatus.DENIED,
    payerName: "Regional Payer Alliance",
    billedCents: 142000,
    denialReason: "CO-16: claim lacks supporting documentation for procedure",
    submittedAt: new Date(t0.getTime() + 86400000 * 2),
    timeline: [
      { label: "Submitted", at: new Date(t0.getTime() + 86400000 * 2) },
      { label: "277CA accepted", at: new Date(t0.getTime() + 86400000 * 3) },
      {
        label: "835 denial / CARC adjustment",
        detail: "CO-16 documentation",
        at: new Date(t0.getTime() + 86400000 * 6),
      },
    ],
  });

  await mkClaim({
    tenantId: tenantTamarackHayward.id,
    patientId: patTam1.id,
    claimNumber: "CLM-TAM-4401",
    status: ClaimLifecycleStatus.SUBMITTED,
    payerName: "Pacific Payer Network",
    billedCents: 210000,
    submittedAt: new Date(t0.getTime() + 86400000 * 4),
    timeline: [
      { label: "Ready for submit", at: new Date(t0.getTime() + 86400000 * 3) },
      { label: "Submitted — awaiting 277", at: new Date(t0.getTime() + 86400000 * 4) },
    ],
  });

  await mkClaim({
    tenantId: tenantLco.id,
    claimNumber: "CLM-LCO-9003",
    status: ClaimLifecycleStatus.APPEALED,
    payerName: "Regional Payer Alliance",
    billedCents: 76000,
    denialReason: "CO-50 non-covered (investigational) — appealed with clinical letter",
    submittedAt: new Date(t0.getTime() + 86400000 * 12),
    timeline: [
      { label: "Original denial", at: new Date(t0.getTime() + 86400000 * 15) },
      {
        label: "Appeal packet sent",
        detail: "Clinical + policy citation",
        at: new Date(t0.getTime() + 86400000 * 18),
      },
    ],
  });

  // --- Pay: statements ---
  const stmt1 = await prisma.statement.create({
    data: {
      tenantId: tenantLco.id,
      patientId: patLco1.id,
      encounterId: encLco1.id,
      number: "STMT-LCO-12001",
      totalCents: 125000,
      balanceCents: 42000,
      status: "partially_paid",
      dueDate: new Date("2026-04-15"),
    },
  });

  await prisma.statementLine.createMany({
    data: [
      {
        statementId: stmt1.id,
        code: "Copay",
        description: "Specialist copay — cardiology",
        amountCents: 4000,
      },
      {
        statementId: stmt1.id,
        code: "Coinsurance",
        description: "Coinsurance after deductible",
        amountCents: 35000,
      },
      {
        statementId: stmt1.id,
        code: "Self-pay",
        description: "Uncovered portion — estimator",
        amountCents: 86000,
      },
    ],
  });

  await prisma.payment.create({
    data: {
      tenantId: tenantLco.id,
      statementId: stmt1.id,
      amountCents: 83000,
      status: "posted",
      method: "card",
      paidAt: new Date("2026-03-22"),
    },
  });

  await prisma.coverAssistanceCase.createMany({
    data: [
      {
        tenantId: tenantLco.id,
        patientId: patLco1.id,
        track: "financial_assistance",
        status: "in_review",
        householdSize: 2,
        annualIncomeCents: 42_000_00,
        notes:
          "Seed: financial assistance inquiry after cardiology statement.",
      },
      {
        tenantId: tenantLco.id,
        patientId: patLco2.id,
        track: "coverage_marketplace",
        status: "submitted",
        notes:
          "Seed: uninsured — marketplace / Medicaid screening requested.",
      },
    ],
  });

  await prisma.supportTask.createMany({
    data: [
      {
        tenantId: tenantLco.id,
        patientId: patLco1.id,
        statementId: stmt1.id,
        title: "Callback — payment plan options",
        detail:
          "Patient asked for a longer plan on remaining balance.",
        status: "open",
        priority: "normal",
        category: "payment_plan",
        dueAt: new Date("2026-03-28T17:00:00Z"),
      },
      {
        tenantId: tenantLco.id,
        patientId: patLco2.id,
        title: "EOB mismatch — coinsurance line",
        status: "in_progress",
        priority: "high",
        category: "billing_question",
      },
    ],
  });

  const patDemo = await prisma.patient.create({
    data: {
      tenantId: tenantDemo.id,
      mrn: "DEMO-1001",
      firstName: "Riley",
      lastName: "Nguyen",
      dob: new Date("1991-01-09"),
    },
  });

  const stmtDemo = await prisma.statement.create({
    data: {
      tenantId: tenantDemo.id,
      patientId: patDemo.id,
      number: "STMT-DEMO-1",
      totalCents: 15000,
      balanceCents: 15000,
      status: "open",
      dueDate: new Date("2026-04-01"),
    },
  });

  await prisma.statementLine.create({
    data: {
      statementId: stmtDemo.id,
      code: "Facility",
      description: "Outpatient visit balance",
      amountCents: 15000,
    },
  });

  // --- Audit trail (sample) ---
  await prisma.auditEvent.createMany({
    data: [
      {
        tenantId: tenantLco.id,
        actorUserId: userLco.id,
        action: "tenant.settings.viewed",
        resource: "tenant",
        metadata: { path: "/o/lco/settings" },
      },
      {
        tenantId: tenantLco.id,
        actorUserId: userLco.id,
        action: "build.draft.opened",
        resource: "claim_draft",
        metadata: { draftId: draftLco.id },
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
    tenants: ["lco", "hayward", "ashland", "pilot"],
    operatorAccounts: [
      userSuper.email,
      userLco.email,
      userTamarack.email,
      userDemo.email,
    ],
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

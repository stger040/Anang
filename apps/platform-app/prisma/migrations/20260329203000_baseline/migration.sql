-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModuleKey" AS ENUM ('CORE', 'BUILD', 'PAY', 'CONNECT', 'INSIGHT', 'SUPPORT', 'COVER');

-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('SUPER_ADMIN', 'TENANT_ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "ClaimLifecycleStatus" AS ENUM ('DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED', 'DENIED', 'PAID', 'APPEALED');

-- CreateEnum
CREATE TYPE "ClaimIssueSource" AS ENUM ('RULE', 'RETRIEVAL', 'MODEL', 'SEED');

-- CreateEnum
CREATE TYPE "CanonicalResourceType" AS ENUM ('PATIENT', 'ENCOUNTER', 'CLAIM', 'STATEMENT', 'CLAIM_DRAFT');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "logoUrl" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildRulePack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildRulePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildKnowledgeChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceLabel" TEXT,

    CONSTRAINT "BuildKnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildDraftEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildDraftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvite" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "membershipRole" "AppRole" NOT NULL DEFAULT 'STAFF',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "appRole" "AppRole" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" "ModuleKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ModuleEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "mrn" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dob" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coverage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "subscriberRel" TEXT NOT NULL DEFAULT 'self',
    "payerName" TEXT NOT NULL,
    "memberId" TEXT,
    "groupNumber" TEXT,
    "planName" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'primary',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "rawMetadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Coverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "dateOfService" TIMESTAMP(3) NOT NULL,
    "chiefComplaint" TEXT,
    "visitSummary" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'queued',

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDraft" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "ClaimDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimDraftLine" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "cpt" TEXT NOT NULL,
    "icd10" TEXT NOT NULL,
    "modifier" TEXT,
    "units" INTEGER NOT NULL DEFAULT 1,
    "chargeCents" INTEGER NOT NULL,
    "aiRationale" TEXT NOT NULL,

    CONSTRAINT "ClaimDraftLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimIssue" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "explainability" TEXT NOT NULL,
    "ruleKey" TEXT,
    "issueSource" "ClaimIssueSource",
    "citations" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "ClaimIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT,
    "claimNumber" TEXT NOT NULL,
    "status" "ClaimLifecycleStatus" NOT NULL,
    "payerName" TEXT,
    "billedCents" INTEGER NOT NULL,
    "paidCents" INTEGER,
    "denialReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "sourceClaimDraftId" TEXT,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimTimelineEvent" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "ClaimTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Statement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "number" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Statement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,

    CONSTRAINT "StatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "statementId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT,
    "paidAt" TIMESTAMP(3),
    "stripeCheckoutSessionId" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverAssistanceCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "householdSize" INTEGER,
    "annualIncomeCents" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverAssistanceCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT,
    "statementId" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "category" TEXT,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectorKind" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ingestionBatchId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sha256Hex" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "textPayload" TEXT,
    "storageUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalIdentifier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "resourceType" "CanonicalResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "system" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ExternalIdentifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BuildRulePack_tenantId_key" ON "BuildRulePack"("tenantId");

-- CreateIndex
CREATE INDEX "BuildKnowledgeChunk_tenantId_kind_idx" ON "BuildKnowledgeChunk"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BuildKnowledgeChunk_tenantId_kind_lookupKey_key" ON "BuildKnowledgeChunk"("tenantId", "kind", "lookupKey");

-- CreateIndex
CREATE INDEX "BuildDraftEvent_tenantId_draftId_idx" ON "BuildDraftEvent"("tenantId", "draftId");

-- CreateIndex
CREATE INDEX "BuildDraftEvent_draftId_createdAt_idx" ON "BuildDraftEvent"("draftId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvite_tokenHash_key" ON "UserInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "UserInvite_tenantId_idx" ON "UserInvite"("tenantId");

-- CreateIndex
CREATE INDEX "UserInvite_email_idx" ON "UserInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_tenantId_idx" ON "Membership"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_tenantId_key" ON "Membership"("userId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ModuleEntitlement_tenantId_module_key" ON "ModuleEntitlement"("tenantId", "module");

-- CreateIndex
CREATE INDEX "Patient_tenantId_idx" ON "Patient"("tenantId");

-- CreateIndex
CREATE INDEX "Coverage_tenantId_idx" ON "Coverage"("tenantId");

-- CreateIndex
CREATE INDEX "Coverage_tenantId_patientId_idx" ON "Coverage"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "Encounter_tenantId_idx" ON "Encounter"("tenantId");

-- CreateIndex
CREATE INDEX "ClaimDraft_tenantId_idx" ON "ClaimDraft"("tenantId");

-- CreateIndex
CREATE INDEX "ClaimIssue_draftId_issueSource_idx" ON "ClaimIssue"("draftId", "issueSource");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_sourceClaimDraftId_key" ON "Claim"("sourceClaimDraftId");

-- CreateIndex
CREATE INDEX "Claim_tenantId_idx" ON "Claim"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_tenantId_claimNumber_key" ON "Claim"("tenantId", "claimNumber");

-- CreateIndex
CREATE INDEX "Statement_tenantId_idx" ON "Statement"("tenantId");

-- CreateIndex
CREATE INDEX "Statement_encounterId_idx" ON "Statement"("encounterId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeCheckoutSessionId_key" ON "Payment"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "CoverAssistanceCase_tenantId_idx" ON "CoverAssistanceCase"("tenantId");

-- CreateIndex
CREATE INDEX "CoverAssistanceCase_tenantId_status_idx" ON "CoverAssistanceCase"("tenantId", "status");

-- CreateIndex
CREATE INDEX "SupportTask_tenantId_idx" ON "SupportTask"("tenantId");

-- CreateIndex
CREATE INDEX "SupportTask_tenantId_status_idx" ON "SupportTask"("tenantId", "status");

-- CreateIndex
CREATE INDEX "IngestionBatch_tenantId_idx" ON "IngestionBatch"("tenantId");

-- CreateIndex
CREATE INDEX "IngestionBatch_tenantId_connectorKind_idx" ON "IngestionBatch"("tenantId", "connectorKind");

-- CreateIndex
CREATE UNIQUE INDEX "SourceArtifact_ingestionBatchId_key" ON "SourceArtifact"("ingestionBatchId");

-- CreateIndex
CREATE INDEX "SourceArtifact_tenantId_idx" ON "SourceArtifact"("tenantId");

-- CreateIndex
CREATE INDEX "SourceArtifact_tenantId_sha256Hex_idx" ON "SourceArtifact"("tenantId", "sha256Hex");

-- CreateIndex
CREATE INDEX "ExternalIdentifier_tenantId_resourceType_resourceId_idx" ON "ExternalIdentifier"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalIdentifier_tenantId_resourceType_system_value_key" ON "ExternalIdentifier"("tenantId", "resourceType", "system", "value");

-- AddForeignKey
ALTER TABLE "BuildRulePack" ADD CONSTRAINT "BuildRulePack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildKnowledgeChunk" ADD CONSTRAINT "BuildKnowledgeChunk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDraftEvent" ADD CONSTRAINT "BuildDraftEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildDraftEvent" ADD CONSTRAINT "BuildDraftEvent_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvite" ADD CONSTRAINT "UserInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleEntitlement" ADD CONSTRAINT "ModuleEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coverage" ADD CONSTRAINT "Coverage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDraft" ADD CONSTRAINT "ClaimDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDraft" ADD CONSTRAINT "ClaimDraft_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimDraftLine" ADD CONSTRAINT "ClaimDraftLine_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimIssue" ADD CONSTRAINT "ClaimIssue_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_sourceClaimDraftId_fkey" FOREIGN KEY ("sourceClaimDraftId") REFERENCES "ClaimDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimTimelineEvent" ADD CONSTRAINT "ClaimTimelineEvent_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Statement" ADD CONSTRAINT "Statement_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementLine" ADD CONSTRAINT "StatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAssistanceCase" ADD CONSTRAINT "CoverAssistanceCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverAssistanceCase" ADD CONSTRAINT "CoverAssistanceCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTask" ADD CONSTRAINT "SupportTask_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionBatch" ADD CONSTRAINT "IngestionBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceArtifact" ADD CONSTRAINT "SourceArtifact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceArtifact" ADD CONSTRAINT "SourceArtifact_ingestionBatchId_fkey" FOREIGN KEY ("ingestionBatchId") REFERENCES "IngestionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalIdentifier" ADD CONSTRAINT "ExternalIdentifier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

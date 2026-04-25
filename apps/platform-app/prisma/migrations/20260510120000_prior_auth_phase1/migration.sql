-- Phase 1: Prior authorization (Connect sub-workspace) — medical benefit tracking only.

CREATE TYPE "PriorAuthStatus" AS ENUM (
  'DRAFT',
  'INTAKE',
  'REVIEW_REQUIRED',
  'SUBMITTED',
  'IN_REVIEW',
  'PENDING_INFO',
  'APPROVED',
  'DENIED',
  'EXPIRED',
  'CANCELLED',
  'REWORK'
);

CREATE TYPE "PriorAuthUrgency" AS ENUM ('ROUTINE', 'URGENT', 'EXPEDITED');

CREATE TYPE "PriorAuthSubmissionMethod" AS ENUM (
  'NOT_SUBMITTED',
  'PORTAL',
  'FAX',
  'PHONE',
  'EMAIL',
  'OTHER'
);

CREATE TYPE "PriorAuthChecklistStatus" AS ENUM ('PENDING', 'DONE', 'NA', 'BLOCKED');

CREATE TYPE "PriorAuthServiceCodeType" AS ENUM ('CPT', 'HCPCS', 'OTHER');

CREATE TABLE "PriorAuthCase" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "encounterId" TEXT,
  "claimId" TEXT,
  "coverageId" TEXT,
  "caseNumber" TEXT NOT NULL,
  "status" "PriorAuthStatus" NOT NULL DEFAULT 'DRAFT',
  "urgency" "PriorAuthUrgency" NOT NULL DEFAULT 'ROUTINE',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "source" TEXT NOT NULL DEFAULT 'staff',
  "submissionMethod" "PriorAuthSubmissionMethod" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "payerName" TEXT NOT NULL,
  "payerPlanName" TEXT,
  "externalPayerId" TEXT,
  "authorizationNumber" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "decisionAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "reworkMetrics" JSONB,
  "externalRefs" JSONB,
  "payerDecision" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PriorAuthCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriorAuthCase_tenantId_caseNumber_key" ON "PriorAuthCase" ("tenantId", "caseNumber");

CREATE INDEX "PriorAuthCase_tenantId_status_idx" ON "PriorAuthCase" ("tenantId", "status");

CREATE INDEX "PriorAuthCase_tenantId_patientId_idx" ON "PriorAuthCase" ("tenantId", "patientId");

CREATE INDEX "PriorAuthCase_tenantId_dueAt_idx" ON "PriorAuthCase" ("tenantId", "dueAt");

CREATE INDEX "PriorAuthCase_tenantId_expiresAt_idx" ON "PriorAuthCase" ("tenantId", "expiresAt");

ALTER TABLE "PriorAuthCase"
  ADD CONSTRAINT "PriorAuthCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriorAuthCase"
  ADD CONSTRAINT "PriorAuthCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PriorAuthCase"
  ADD CONSTRAINT "PriorAuthCase_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriorAuthCase"
  ADD CONSTRAINT "PriorAuthCase_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriorAuthCase"
  ADD CONSTRAINT "PriorAuthCase_coverageId_fkey" FOREIGN KEY ("coverageId") REFERENCES "Coverage" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PriorAuthService" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "codeType" "PriorAuthServiceCodeType" NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "units" INTEGER NOT NULL DEFAULT 1,
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PriorAuthService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriorAuthService_caseId_idx" ON "PriorAuthService" ("caseId");

ALTER TABLE "PriorAuthService"
  ADD CONSTRAINT "PriorAuthService_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorAuthCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PriorAuthChecklistItem" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" "PriorAuthChecklistStatus" NOT NULL DEFAULT 'PENDING',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PriorAuthChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriorAuthChecklistItem_caseId_idx" ON "PriorAuthChecklistItem" ("caseId");

ALTER TABLE "PriorAuthChecklistItem"
  ADD CONSTRAINT "PriorAuthChecklistItem_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorAuthCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PriorAuthAttachment" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "fileName" TEXT,
  "mimeType" TEXT,
  "storageUri" TEXT,
  "byteSize" INTEGER,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PriorAuthAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriorAuthAttachment_caseId_idx" ON "PriorAuthAttachment" ("caseId");

ALTER TABLE "PriorAuthAttachment"
  ADD CONSTRAINT "PriorAuthAttachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorAuthCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PriorAuthEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PriorAuthEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriorAuthEvent_caseId_createdAt_idx" ON "PriorAuthEvent" ("caseId", "createdAt");

ALTER TABLE "PriorAuthEvent"
  ADD CONSTRAINT "PriorAuthEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorAuthCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PriorAuthStatusPoll" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "polledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "statusSnapshot" TEXT,
  "responseSummary" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT "PriorAuthStatusPoll_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PriorAuthStatusPoll_caseId_polledAt_idx" ON "PriorAuthStatusPoll" ("caseId", "polledAt");

ALTER TABLE "PriorAuthStatusPoll"
  ADD CONSTRAINT "PriorAuthStatusPoll_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "PriorAuthCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

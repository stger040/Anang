-- CreateEnum
CREATE TYPE "ClaimDraftLineSource" AS ENUM ('IMPORTED', 'AI_SUGGESTION');

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "placeOfService" TEXT,
ADD COLUMN     "visitType" TEXT,
ADD COLUMN     "assessment" TEXT,
ADD COLUMN     "providerSpecialty" TEXT;

-- AlterTable
ALTER TABLE "ClaimDraftLine" ADD COLUMN     "lineSource" "ClaimDraftLineSource" NOT NULL DEFAULT 'IMPORTED';

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'synthetic_testing',
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleRate" (
    "id" TEXT NOT NULL,
    "feeScheduleId" TEXT NOT NULL,
    "cptNormalized" TEXT NOT NULL,
    "placeOfServiceKey" TEXT NOT NULL DEFAULT '',
    "chargeCents" INTEGER NOT NULL,
    "derivedFromImport" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeScheduleRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildSuggestionRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "rawResponseJson" JSONB,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildSuggestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildSuggestionLine" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "icd10" TEXT NOT NULL,
    "cpt" TEXT NOT NULL,
    "modifier" TEXT,
    "units" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "feeScheduleRateId" TEXT,
    "chargeCentsApplied" INTEGER NOT NULL,
    "claimDraftLineId" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BuildSuggestionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeSchedule_tenantId_name_key" ON "FeeSchedule"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FeeSchedule_tenantId_idx" ON "FeeSchedule"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScheduleRate_feeScheduleId_cptNormalized_placeOfServiceKey_key" ON "FeeScheduleRate"("feeScheduleId", "cptNormalized", "placeOfServiceKey");

-- CreateIndex
CREATE INDEX "FeeScheduleRate_feeScheduleId_cptNormalized_idx" ON "FeeScheduleRate"("feeScheduleId", "cptNormalized");

-- CreateIndex
CREATE INDEX "BuildSuggestionRun_tenantId_encounterId_idx" ON "BuildSuggestionRun"("tenantId", "encounterId");

-- CreateIndex
CREATE INDEX "BuildSuggestionRun_draftId_createdAt_idx" ON "BuildSuggestionRun"("draftId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BuildSuggestionLine_claimDraftLineId_key" ON "BuildSuggestionLine"("claimDraftLineId");

-- CreateIndex
CREATE INDEX "BuildSuggestionLine_runId_idx" ON "BuildSuggestionLine"("runId");

-- AddForeignKey
ALTER TABLE "FeeSchedule" ADD CONSTRAINT "FeeSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeScheduleRate" ADD CONSTRAINT "FeeScheduleRate_feeScheduleId_fkey" FOREIGN KEY ("feeScheduleId") REFERENCES "FeeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionRun" ADD CONSTRAINT "BuildSuggestionRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionRun" ADD CONSTRAINT "BuildSuggestionRun_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionRun" ADD CONSTRAINT "BuildSuggestionRun_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ClaimDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionLine" ADD CONSTRAINT "BuildSuggestionLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "BuildSuggestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionLine" ADD CONSTRAINT "BuildSuggestionLine_feeScheduleRateId_fkey" FOREIGN KEY ("feeScheduleRateId") REFERENCES "FeeScheduleRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildSuggestionLine" ADD CONSTRAINT "BuildSuggestionLine_claimDraftLineId_fkey" FOREIGN KEY ("claimDraftLineId") REFERENCES "ClaimDraftLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

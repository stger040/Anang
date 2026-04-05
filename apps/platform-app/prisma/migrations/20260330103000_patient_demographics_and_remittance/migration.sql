-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "sex" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "preferredLanguage" TEXT,
ADD COLUMN     "demographicsExtra" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "Remittance835" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "remittanceKey" TEXT NOT NULL,
    "eraTraceNumber" TEXT,
    "source" TEXT NOT NULL DEFAULT 'excel_synthetic',
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Remittance835_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimAdjudication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "remittance835Id" TEXT NOT NULL,
    "adjudicationKey" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "encounterKey" TEXT,
    "patientKey" TEXT,
    "providerKey" TEXT,
    "payerName" TEXT,
    "insuranceType" TEXT,
    "claimSubmissionDate" TIMESTAMP(3),
    "adjudicationDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "adjudicationPhase" TEXT,
    "claimStatusAtAdjudication" TEXT,
    "payerClaimControlNumber" TEXT,
    "allowedCents" INTEGER NOT NULL DEFAULT 0,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "patientResponsibilityCents" INTEGER NOT NULL DEFAULT 0,
    "deductibleCents" INTEGER NOT NULL DEFAULT 0,
    "copayCents" INTEGER NOT NULL DEFAULT 0,
    "coinsuranceCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "denialCategory" TEXT,
    "finalizedFlag" BOOLEAN NOT NULL DEFAULT false,
    "appealEligibleFlag" BOOLEAN NOT NULL DEFAULT false,
    "extra" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ClaimAdjudication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemittanceAdjudicationLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimAdjudicationId" TEXT NOT NULL,
    "remittanceLineKey" TEXT NOT NULL,
    "claimLineKey" TEXT,
    "encounterKey" TEXT,
    "patientKey" TEXT,
    "providerKey" TEXT,
    "adjudicationDate" TIMESTAMP(3),
    "paidDate" TIMESTAMP(3),
    "procedureCode" TEXT,
    "procedureDescription" TEXT,
    "lineBilledCents" INTEGER NOT NULL DEFAULT 0,
    "lineAllowedCents" INTEGER NOT NULL DEFAULT 0,
    "linePaidCents" INTEGER NOT NULL DEFAULT 0,
    "patientResponsibilityCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "carcCode" TEXT,
    "carcDescription" TEXT,
    "rarcCode" TEXT,
    "rarcDescription" TEXT,
    "lineAdjudicationStatus" TEXT,
    "denialCategory" TEXT,
    "extra" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "RemittanceAdjudicationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Remittance835_tenantId_remittanceKey_key" ON "Remittance835"("tenantId", "remittanceKey");

-- CreateIndex
CREATE INDEX "Remittance835_tenantId_idx" ON "Remittance835"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimAdjudication_tenantId_adjudicationKey_key" ON "ClaimAdjudication"("tenantId", "adjudicationKey");

-- CreateIndex
CREATE INDEX "ClaimAdjudication_tenantId_claimId_idx" ON "ClaimAdjudication"("tenantId", "claimId");

-- CreateIndex
CREATE INDEX "ClaimAdjudication_remittance835Id_idx" ON "ClaimAdjudication"("remittance835Id");

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceAdjudicationLine_tenantId_remittanceLineKey_key" ON "RemittanceAdjudicationLine"("tenantId", "remittanceLineKey");

-- CreateIndex
CREATE INDEX "RemittanceAdjudicationLine_tenantId_claimAdjudicationId_idx" ON "RemittanceAdjudicationLine"("tenantId", "claimAdjudicationId");

-- AddForeignKey
ALTER TABLE "Remittance835" ADD CONSTRAINT "Remittance835_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAdjudication" ADD CONSTRAINT "ClaimAdjudication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAdjudication" ADD CONSTRAINT "ClaimAdjudication_remittance835Id_fkey" FOREIGN KEY ("remittance835Id") REFERENCES "Remittance835"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimAdjudication" ADD CONSTRAINT "ClaimAdjudication_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceAdjudicationLine" ADD CONSTRAINT "RemittanceAdjudicationLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceAdjudicationLine" ADD CONSTRAINT "RemittanceAdjudicationLine_claimAdjudicationId_fkey" FOREIGN KEY ("claimAdjudicationId") REFERENCES "ClaimAdjudication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

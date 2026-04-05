-- CreateTable
CREATE TABLE "Claim837EdiSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "interchangeControlNumber" TEXT,
    "groupControlNumber" TEXT,
    "transactionSetControlNumber" TEXT,
    "submitterTraceNumber" TEXT,
    "payerClaimControlRef" TEXT,
    "clearinghouseLabel" TEXT,
    "notes" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" TEXT,

    CONSTRAINT "Claim837EdiSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Claim837EdiSubmission_tenantId_claimId_idx" ON "Claim837EdiSubmission"("tenantId", "claimId");

-- CreateIndex
CREATE INDEX "Claim837EdiSubmission_claimId_recordedAt_idx" ON "Claim837EdiSubmission"("claimId", "recordedAt");

-- AddForeignKey
ALTER TABLE "Claim837EdiSubmission" ADD CONSTRAINT "Claim837EdiSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim837EdiSubmission" ADD CONSTRAINT "Claim837EdiSubmission_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

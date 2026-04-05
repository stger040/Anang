-- CreateTable
CREATE TABLE "RemittanceAdjudicationAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "remittanceAdjudicationLineId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "claimAdjustmentGroupCode" TEXT NOT NULL,
    "carcCode" TEXT NOT NULL,
    "adjustmentAmountCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER,
    "rarcCodes" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "RemittanceAdjudicationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientPushSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orgSlug" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RemittanceAdjudicationAdjustment_remittanceAdjudicationLineId_sequence_key" ON "RemittanceAdjudicationAdjustment"("remittanceAdjudicationLineId", "sequence");

-- CreateIndex
CREATE INDEX "RemittanceAdjudicationAdjustment_tenantId_remittanceAdjudicationLineId_idx" ON "RemittanceAdjudicationAdjustment"("tenantId", "remittanceAdjudicationLineId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPushSubscription_tenantId_endpoint_key" ON "PatientPushSubscription"("tenantId", "endpoint");

-- CreateIndex
CREATE INDEX "PatientPushSubscription_tenantId_idx" ON "PatientPushSubscription"("tenantId");

-- AddForeignKey
ALTER TABLE "RemittanceAdjudicationAdjustment" ADD CONSTRAINT "RemittanceAdjudicationAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemittanceAdjudicationAdjustment" ADD CONSTRAINT "RemittanceAdjudicationAdjustment_remittanceAdjudicationLineId_fkey" FOREIGN KEY ("remittanceAdjudicationLineId") REFERENCES "RemittanceAdjudicationLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPushSubscription" ADD CONSTRAINT "PatientPushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

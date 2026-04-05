-- CreateTable
CREATE TABLE "StatementPaymentPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Payment plan',
    "status" TEXT NOT NULL DEFAULT 'offered',
    "installmentCount" INTEGER NOT NULL,
    "intervalWeeks" INTEGER NOT NULL DEFAULT 4,
    "perInstallmentCents" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "patientAcknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatementPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlanInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "PaymentPlanInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatementPaymentPlan_statementId_key" ON "StatementPaymentPlan"("statementId");

-- CreateIndex
CREATE INDEX "StatementPaymentPlan_tenantId_idx" ON "StatementPaymentPlan"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentPlanInstallment_planId_idx" ON "PaymentPlanInstallment"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentPlanInstallment_planId_sequence_key" ON "PaymentPlanInstallment"("planId", "sequence");

-- AddForeignKey
ALTER TABLE "StatementPaymentPlan" ADD CONSTRAINT "StatementPaymentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatementPaymentPlan" ADD CONSTRAINT "StatementPaymentPlan_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "Statement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanInstallment" ADD CONSTRAINT "PaymentPlanInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StatementPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

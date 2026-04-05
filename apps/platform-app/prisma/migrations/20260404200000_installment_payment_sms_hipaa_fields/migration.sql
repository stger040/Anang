-- Patient SMS consent (transactional billing)
ALTER TABLE "Patient" ADD COLUMN "billingSmsOptInAt" TIMESTAMP(3);
ALTER TABLE "Patient" ADD COLUMN "billingSmsOptOutAt" TIMESTAMP(3);

-- Installment ↔ posted payment + partial satisfaction
ALTER TABLE "PaymentPlanInstallment" ADD COLUMN "satisfiedCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PaymentPlanInstallment" ADD COLUMN "paymentId" TEXT;

CREATE INDEX "PaymentPlanInstallment_paymentId_idx" ON "PaymentPlanInstallment"("paymentId");

ALTER TABLE "PaymentPlanInstallment" ADD CONSTRAINT "PaymentPlanInstallment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

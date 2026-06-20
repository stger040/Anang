-- Mobile payments: idempotency key for Stripe PaymentIntent (Payment Sheet on iOS/Android).
ALTER TABLE "Payment" ADD COLUMN "stripePaymentIntentId" TEXT;
CREATE UNIQUE INDEX "Payment_stripePaymentIntentId_key" ON "Payment"("stripePaymentIntentId");

-- Expo mobile push tokens for patient billing notifications.
CREATE TABLE "PatientExpoPushToken" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientExpoPushToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PatientExpoPushToken_tenantId_token_key"
    ON "PatientExpoPushToken"("tenantId", "token");

CREATE INDEX "PatientExpoPushToken_tenantId_patientId_idx"
    ON "PatientExpoPushToken"("tenantId", "patientId");

ALTER TABLE "PatientExpoPushToken"
    ADD CONSTRAINT "PatientExpoPushToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PatientExpoPushToken"
    ADD CONSTRAINT "PatientExpoPushToken_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

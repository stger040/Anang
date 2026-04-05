-- CreateTable
CREATE TABLE "PatientPortalIdentity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "lastSessionVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientPortalIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientPortalIdentity_patientId_key" ON "PatientPortalIdentity"("patientId");

-- CreateIndex
CREATE INDEX "PatientPortalIdentity_tenantId_idx" ON "PatientPortalIdentity"("tenantId");

-- AddForeignKey
ALTER TABLE "PatientPortalIdentity" ADD CONSTRAINT "PatientPortalIdentity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPortalIdentity" ADD CONSTRAINT "PatientPortalIdentity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

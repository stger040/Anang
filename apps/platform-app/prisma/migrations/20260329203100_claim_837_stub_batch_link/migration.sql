-- AlterTable
ALTER TABLE "Claim" ADD COLUMN "source837StubIngestionBatchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Claim_source837StubIngestionBatchId_key" ON "Claim"("source837StubIngestionBatchId");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_source837StubIngestionBatchId_fkey" FOREIGN KEY ("source837StubIngestionBatchId") REFERENCES "IngestionBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

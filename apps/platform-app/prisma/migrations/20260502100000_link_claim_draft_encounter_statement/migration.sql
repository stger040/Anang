-- Optional linkage: Build encounter/draft -> Connect claim -> Pay statement (demo + pilot clarity).

-- AlterTable Claim
ALTER TABLE "Claim" ADD COLUMN "encounterId" TEXT,
ADD COLUMN "claimDraftId" TEXT;

CREATE UNIQUE INDEX "Claim_claimDraftId_key" ON "Claim"("claimDraftId");

CREATE INDEX "Claim_encounterId_idx" ON "Claim"("encounterId");

ALTER TABLE "Claim" ADD CONSTRAINT "Claim_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Claim" ADD CONSTRAINT "Claim_claimDraftId_fkey" FOREIGN KEY ("claimDraftId") REFERENCES "ClaimDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable Statement
ALTER TABLE "Statement" ADD COLUMN "claimId" TEXT;

CREATE INDEX "Statement_claimId_idx" ON "Statement"("claimId");

ALTER TABLE "Statement" ADD CONSTRAINT "Statement_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

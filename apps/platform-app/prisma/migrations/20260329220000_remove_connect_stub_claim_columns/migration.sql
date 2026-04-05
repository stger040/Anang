-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT IF EXISTS "Claim_source837StubIngestionBatchId_fkey";

-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT IF EXISTS "Claim_sourceClaimDraftId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Claim_source837StubIngestionBatchId_key";

-- DropIndex
DROP INDEX IF EXISTS "Claim_sourceClaimDraftId_key";

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN IF EXISTS "source837StubIngestionBatchId";

-- AlterTable
ALTER TABLE "Claim" DROP COLUMN IF EXISTS "sourceClaimDraftId";

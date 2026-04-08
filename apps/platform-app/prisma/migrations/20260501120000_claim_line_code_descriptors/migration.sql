-- Short display labels for CPT/ICD-10 on draft lines (AI + static fallback in app).
ALTER TABLE "ClaimDraftLine" ADD COLUMN     "icd10Descriptor" TEXT,
ADD COLUMN     "cptDescriptor" TEXT;

ALTER TABLE "BuildSuggestionLine" ADD COLUMN     "icd10Descriptor" TEXT,
ADD COLUMN     "cptDescriptor" TEXT;

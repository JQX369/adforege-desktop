-- Phase 6 Print Pipeline schema changes

-- Add print pipeline fields to Story
ALTER TABLE "Story" ADD COLUMN "printStatus" TEXT;
ALTER TABLE "Story" ADD COLUMN "printMetadata" JSONB;

-- Add Google Drive folder ID to Partner
ALTER TABLE "Partner" ADD COLUMN "driveFolderId" TEXT;


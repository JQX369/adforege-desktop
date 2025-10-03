-- Add comprehensive product data fields for robust ingestion
-- Handles pricing, shipping, delivery, inventory, and quality metrics

-- Add pricing & discount fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "originalPrice" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION;

-- Add shipping & delivery fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shippingCost" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "freeShipping" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryDays" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryMin" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryMax" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "primeEligible" BOOLEAN;

-- Add inventory fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "inStock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockQuantity" INTEGER;

-- Add product detail enhancements
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imagesThumbnail" TEXT[];
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "shortDescription" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "features" TEXT[];

-- Add physical attributes
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "dimensions" TEXT;

-- Add condition field
DO $$ BEGIN
  CREATE TYPE "ProductCondition" AS ENUM (
    'NEW',
    'LIKE_NEW', 
    'USED_VERY_GOOD',
    'USED_GOOD',
    'USED_ACCEPTABLE',
    'REFURBISHED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "condition" "ProductCondition" NOT NULL DEFAULT 'NEW';

-- Add quality & trust fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bestSeller" BOOLEAN NOT NULL DEFAULT false;

-- Add seller information fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellerName" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellerRating" DOUBLE PRECISION;

-- Add data provenance fields
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sourceItemId" TEXT;  -- eBay itemId or other external ID
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "lastEnrichedAt" TIMESTAMP(3);  -- When we last got full details

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "Product_inStock_idx" ON "Product"("inStock");
CREATE INDEX IF NOT EXISTS "Product_primeEligible_idx" ON "Product"("primeEligible");
CREATE INDEX IF NOT EXISTS "Product_condition_idx" ON "Product"("condition");
CREATE INDEX IF NOT EXISTS "Product_freeShipping_idx" ON "Product"("freeShipping");
CREATE INDEX IF NOT EXISTS "Product_bestSeller_idx" ON "Product"("bestSeller");
CREATE INDEX IF NOT EXISTS "Product_sourceItemId_idx" ON "Product"("sourceItemId");

-- Update existing products to have sensible defaults
UPDATE "Product" SET "inStock" = true WHERE "inStock" IS NULL;
UPDATE "Product" SET "freeShipping" = false WHERE "freeShipping" IS NULL;
UPDATE "Product" SET "bestSeller" = false WHERE "bestSeller" IS NULL;
UPDATE "Product" SET "condition" = 'NEW' WHERE "condition" IS NULL;


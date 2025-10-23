-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "averagePrice" TEXT,
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "communicationPreferences" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "productCategories" TEXT,
ADD COLUMN     "productCount" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE INDEX "Vendor_onboardingCompleted_idx" ON "Vendor"("onboardingCompleted");

-- CreateIndex
CREATE INDEX "Vendor_businessName_idx" ON "Vendor"("businessName");

-- CreateIndex
CREATE INDEX "Vendor_businessType_idx" ON "Vendor"("businessType");

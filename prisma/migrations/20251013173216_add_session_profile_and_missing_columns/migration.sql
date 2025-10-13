-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "recencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionProfile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "constraints" JSONB,
    "negatives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seen" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionProfile_sessionId_key" ON "SessionProfile"("sessionId");

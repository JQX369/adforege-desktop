-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('IMPRESSION', 'CLICK', 'LIKE', 'DISLIKE', 'SAVE');

-- CreateTable
CREATE TABLE "recommendation_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "productId" TEXT,
    "action" "RecommendationAction" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER NOT NULL,
    "productsCreated" INTEGER NOT NULL,
    "productsUpdated" INTEGER NOT NULL,
    "errors" INTEGER NOT NULL,
    "errorMessages" JSONB,

    CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id")
);

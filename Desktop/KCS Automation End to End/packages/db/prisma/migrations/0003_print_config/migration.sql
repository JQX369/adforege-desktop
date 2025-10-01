-- Phase 6 Print Configuration model

CREATE TABLE "PrintConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partnerId" TEXT,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT FALSE,
    "readingAge" TEXT NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "lineSpacing" INTEGER NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "textColor" TEXT NOT NULL DEFAULT '#000000',
    "textWidthPercent" INTEGER NOT NULL DEFAULT 80,
    "borderPercent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "maxWords" INTEGER,
    "overlayPreferences" JSONB,
    "imageModelPreferences" JSONB,
    "iccProfilePath" TEXT,
    "bleedPercent" DOUBLE PRECISION NOT NULL DEFAULT 3.5,
    "safeMarginMm" DOUBLE PRECISION NOT NULL DEFAULT 6.0,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrintConfig_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PrintConfig_partnerId_readingAge_key" ON "PrintConfig"("partnerId", "readingAge");


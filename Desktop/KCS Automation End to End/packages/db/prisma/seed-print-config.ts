import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seed default print configurations based on legacy BOOKBUILDERpresets.xlsx
 * Source: Kcs Legacy/Book-BuilderV2.py READING_CONFIG
 */

const defaultPrintConfigs = [
  {
    name: "Default 3-4 Years",
    isDefault: true,
    readingAge: "3-4",
    fontSize: 120,
    lineSpacing: 130,
    fontFamily: "Arial",
    textColor: "#000000",
    textWidthPercent: 80,
    borderPercent: 5.0,
    maxWords: 25,
    bleedPercent: 3.5,
    safeMarginMm: 6.0,
    iccProfilePath: "CGATS21_CRPC1.icc",
    overlayPreferences: {
      positions: ["b", "t", "tr", "tl", "br", "bl"],
      maxPositions: ["b", "t"],
      maxCharThreshold: 450,
      aiPlacementEnabled: true,
      overlayFolder: "3-4"
    },
    imageModelPreferences: {
      default: "imagen-3-fast",
      cover_front: "imagen-3-fast",
      cover_back: "imagen-3-fast",
      interior_page: "imagen-3-fast",
      vision_score: "gemini-2.5-flash",
      overlay_position: "gemini-2.5-flash"
    }
  },
  {
    name: "Default 4-6 Years",
    isDefault: true,
    readingAge: "4-6",
    fontSize: 110,
    lineSpacing: 120,
    fontFamily: "Verdana",
    textColor: "#000000",
    textWidthPercent: 80,
    borderPercent: 4.0,
    maxWords: 40,
    bleedPercent: 3.5,
    safeMarginMm: 6.0,
    iccProfilePath: "CGATS21_CRPC1.icc",
    overlayPreferences: {
      positions: ["b", "t", "tr", "tl", "br", "bl"],
      maxPositions: ["b", "t"],
      maxCharThreshold: 450,
      aiPlacementEnabled: true,
      overlayFolder: "4-6"
    },
    imageModelPreferences: {
      default: "imagen-3-fast",
      cover_front: "imagen-3-fast",
      cover_back: "imagen-3-fast",
      interior_page: "imagen-3-fast",
      vision_score: "gemini-2.5-flash",
      overlay_position: "gemini-2.5-flash"
    }
  },
  {
    name: "Default 6-7 Years",
    isDefault: true,
    readingAge: "6-7",
    fontSize: 100,
    lineSpacing: 110,
    fontFamily: "Georgia",
    textColor: "#000000",
    textWidthPercent: 80,
    borderPercent: 3.0,
    maxWords: 60,
    bleedPercent: 3.5,
    safeMarginMm: 6.0,
    iccProfilePath: "CGATS21_CRPC1.icc",
    overlayPreferences: {
      positions: ["b", "t", "tr", "tl", "br", "bl"],
      maxPositions: ["b", "t"],
      maxCharThreshold: 450,
      aiPlacementEnabled: true,
      overlayFolder: "6-7"
    },
    imageModelPreferences: {
      default: "imagen-3-fast",
      cover_front: "imagen-3-fast",
      cover_back: "imagen-3-fast",
      interior_page: "imagen-3-pro",
      vision_score: "gemini-2.5-flash",
      overlay_position: "gemini-2.5-flash"
    }
  },
  {
    name: "Default 8+ Years",
    isDefault: true,
    readingAge: "8",
    fontSize: 90,
    lineSpacing: 100,
    fontFamily: "Arial",
    textColor: "#000000",
    textWidthPercent: 80,
    borderPercent: 2.0,
    maxWords: 100,
    bleedPercent: 3.5,
    safeMarginMm: 6.0,
    iccProfilePath: "CGATS21_CRPC1.icc",
    overlayPreferences: {
      positions: ["b", "t", "tr", "tl", "br", "bl"],
      maxPositions: ["b", "t"],
      maxCharThreshold: 450,
      aiPlacementEnabled: true,
      overlayFolder: "8"
    },
    imageModelPreferences: {
      default: "imagen-3-pro",
      cover_front: "imagen-3-pro",
      cover_back: "imagen-3-pro",
      interior_page: "gpt-image-1",
      vision_score: "gemini-2.5-flash-nano-banana",
      overlay_position: "gemini-2.5-flash"
    }
  }
];

async function seedPrintConfigs() {
  console.log("Seeding print configurations...");

  for (const config of defaultPrintConfigs) {
    const existing = await prisma.printConfig.findFirst({
      where: {
        partnerId: null,
        readingAge: config.readingAge
      }
    });

    if (existing) {
      console.log(`  ✓ Print config for ${config.readingAge} already exists, skipping`);
      continue;
    }

    await prisma.printConfig.create({
      data: {
        ...config,
        partnerId: null // Global default
      }
    });

    console.log(`  ✓ Created default print config for ${config.readingAge}`);
  }

  console.log("Print configuration seeding complete!");
}

seedPrintConfigs()
  .catch((error) => {
    console.error("Error seeding print configs:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


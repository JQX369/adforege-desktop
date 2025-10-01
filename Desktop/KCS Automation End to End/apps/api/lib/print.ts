import { prisma } from "@kcs/db";
import type { OverlayOptions, PrintSettings, ImageModelPreferences } from "@kcs/shared";

export const getPrintSettingsForOrder = async (orderId: string, readingAge: string): Promise<PrintSettings> => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { partnerId: true }
  });

  const config = await prisma.printConfig.findFirst({
    where: {
      OR: [
        { partnerId: order?.partnerId ?? undefined, readingAge },
        { partnerId: null, readingAge, isDefault: true }
      ]
    },
    orderBy: {
      partnerId: "desc"
    }
  });

  if (!config) {
    throw new Error(`No print configuration found for reading age ${readingAge}`);
  }

  return {
    ...config,
    overlayPreferences: (config.overlayPreferences as OverlayOptions) ?? {
      aiPlacementEnabled: true,
      availablePositions: ["b", "t", "tl", "tr", "bl", "br"],
      maxPositions: ["topMAX", "bottomMAX"],
      maxCharThreshold: 450,
      overlayFolder: readingAge,
      manualOverrides: []
    },
    imageModelPreferences: (config.imageModelPreferences as ImageModelPreferences) ?? {
      default: "imagen-3-fast",
      cover_front: "imagen-3-fast",
      cover_back: "imagen-3-fast",
      interior_page: "imagen-3-fast",
      vision_score: "gemini-2.5-flash",
      overlay_position: "gemini-2.5-flash"
    }
  };
};


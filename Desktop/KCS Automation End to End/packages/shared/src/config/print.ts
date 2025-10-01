import type { PrintConfig } from "@prisma/client";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

export interface OverlayOptions {
  aiPlacementEnabled: boolean;
  availablePositions: string[];
  maxPositions: string[];
  maxCharThreshold: number;
  overlayFolder: string;
  manualOverrides?: Array<{
    page: number | "cover";
    position: string;
  }>;
}

export type ImageModelStage =
  | "cover_front"
  | "cover_back"
  | "interior_page"
  | "vision_score"
  | "overlay_position";

export type ImageModelPreferences = Record<ImageModelStage | "default", string>;

export interface PrintSettings extends Omit<PrintConfig, "overlayPreferences" | "imageModelPreferences"> {
  overlayPreferences: OverlayOptions;
  imageModelPreferences: ImageModelPreferences;
}

// Get package root directory (works in both dev and production)
const getPackageRoot = () => {
  // In CommonJS
  if (typeof __dirname !== "undefined") {
    return join(__dirname, "..", "..");
  }
  // In ESM
  if (typeof import.meta.url !== "undefined") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, "..", "..");
  }
  // Fallback to relative path from project root
  return join(process.cwd(), "packages", "shared");
};

export const getOverlayAssetPath = (readingAge: string, position: string, manual?: boolean) => {
  const base = join(getPackageRoot(), "assets", "overlays");
  if (position === "topMAX" || position === "bottomMAX") {
    return `${base}/MAX/${position}.png`;
  }
  const map: Record<string, string> = {
    b: manual ? "bottom.png" : "bottom.png",
    t: manual ? "top.png" : "top.png",
    tl: manual ? "top_left.png" : "top_left.png",
    tr: manual ? "top_right.png" : "top_right.png",
    bl: manual ? "bottom_left.png" : "bottom_left.png",
    br: manual ? "bottom_right.png" : "bottom_right.png"
  };
  return `${base}/${readingAge}/${map[position] ?? "bottom.png"}`;
};



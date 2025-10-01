/**
 * Bleed processing utilities for print-ready images
 * Based on KCS Legacy bleed specifications:
 * - 3mm bleed on all sides (206mm total from 200mm trimmed)
 * - 2433×2433px at 300 DPI (includes bleed)
 * - 3.5%-10% content shrink with edge extension
 */

export interface BleedOptions {
  /** Percentage of content shrink (default: 3.5) */
  bleedPercent?: number;
  /** Target width in pixels (default: 2433) */
  targetWidth?: number;
  /** Target height in pixels (default: 2433) */
  targetHeight?: number;
  /** Edge sampling size for color detection (default: 10px) */
  edgeSampleSize?: number;
}

export interface BleedResult {
  /** Success status */
  success: boolean;
  /** Output image buffer (if successful) */
  buffer?: Buffer;
  /** Error message (if failed) */
  error?: string;
  /** Applied bleed percentage */
  appliedBleed: number;
  /** Detected edge color (hex) */
  dominantEdgeColor?: string;
}

/**
 * Calculate mm to pixels at 300 DPI
 */
export const mmToPixels = (mm: number, dpi = 300): number => {
  return Math.round(mm * (dpi / 25.4));
};

/**
 * Calculate pixels to mm at 300 DPI
 */
export const pixelsToMm = (pixels: number, dpi = 300): number => {
  return pixels / (dpi / 25.4);
};

/**
 * Calculate bleed dimensions
 * Trimmed: 200mm × 200mm = 2362 × 2362 px
 * With bleed: 206mm × 206mm = 2433 × 2433 px (3mm bleed all sides)
 */
export const calculateBleedDimensions = (trimmedWidth: number, trimmedHeight: number, bleedMm = 3, dpi = 300) => {
  const bleedPx = mmToPixels(bleedMm, dpi);
  return {
    trimmedWidth,
    trimmedHeight,
    bleedPx,
    totalWidth: trimmedWidth + 2 * bleedPx,
    totalHeight: trimmedHeight + 2 * bleedPx
  };
};

/**
 * Apply bleed processing to an image buffer
 * This is a mock implementation - actual implementation would use sharp
 *
 * Process:
 * 1. Load image
 * 2. Shrink content by bleedPercent (e.g., 3.5% = 96.5% of original)
 * 3. Center the shrunken content
 * 4. Extend edges using dominant color or nearest pixel replication
 * 5. Resize to target dimensions if needed
 */
export const applyBleedProcessing = async (
  imageBuffer: Buffer,
  options: BleedOptions = {}
): Promise<BleedResult> => {
  const {
    bleedPercent = 3.5,
    targetWidth = 2433,
    targetHeight = 2433,
    edgeSampleSize = 10
  } = options;

  try {
    const sharp = await import("sharp");
    const image = sharp.default(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to read image dimensions");
    }

    const shrinkFactor = (100 - bleedPercent) / 100;
    const shrunkWidth = Math.round(metadata.width * shrinkFactor);
    const shrunkHeight = Math.round(metadata.height * shrinkFactor);

    const dominantColor = await detectDominantEdgeColor(imageBuffer, edgeSampleSize);
    const backgroundColor = hexToRgb(dominantColor) ?? { r: 240, g: 240, b: 240 };

    const padXTotal = Math.max(0, targetWidth - shrunkWidth);
    const padYTotal = Math.max(0, targetHeight - shrunkHeight);
    const padLeft = Math.floor(padXTotal / 2);
    const padRight = padXTotal - padLeft;
    const padTop = Math.floor(padYTotal / 2);
    const padBottom = padYTotal - padTop;

    let pipeline = image.resize(shrunkWidth, shrunkHeight, { fit: "cover" });

    if (padXTotal > 0 || padYTotal > 0) {
      pipeline = pipeline.extend({
        top: padTop,
        bottom: padBottom,
        left: padLeft,
        right: padRight,
        background: backgroundColor
      });
    }

    const resized = await pipeline.resize(targetWidth, targetHeight, { fit: "fill" }).toBuffer();

    return {
      success: true,
      buffer: resized,
      appliedBleed: bleedPercent,
      dominantEdgeColor: dominantColor
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      appliedBleed: bleedPercent
    };
  }
};

/**
 * Detect dominant edge color from image buffer
 * Samples pixels from all four edges and finds most common non-white color
 *
 * @param imageBuffer - Input image buffer
 * @param sampleSize - Number of pixels to sample from each edge (default: 10)
 * @returns Hex color string (e.g., "#f0f0f0")
 */
export const detectDominantEdgeColor = async (
  imageBuffer: Buffer,
  sampleSize = 10
): Promise<string> => {
  try {
    const sharp = await import("sharp");
    const image = sharp.default(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to read image dimensions");
    }

    const { width, height } = metadata;
    const sampleHeight = Math.max(1, Math.min(sampleSize, Math.floor(height / 4)));
    const sampleWidth = Math.max(1, Math.min(sampleSize, Math.floor(width / 4)));

    const edgeCoordinates = [
      { left: 0, top: 0, width, height: sampleHeight }, // top
      { left: 0, top: Math.max(0, height - sampleHeight), width, height: sampleHeight }, // bottom
      { left: 0, top: 0, width: sampleWidth, height }, // left
      { left: Math.max(0, width - sampleWidth), top: 0, width: sampleWidth, height } // right
    ];

    const colorCounts = new Map<string, number>();

    for (const region of edgeCoordinates) {
      let extractor = image.clone().extract(region);

      if ((metadata.channels ?? 3) > 3) {
        extractor = extractor.removeAlpha();
      }

      const raw = await extractor.raw().toBuffer();
      const channels = Math.min(metadata.channels ?? 3, 3);

      for (let i = 0; i < raw.length; i += channels) {
        const r = raw[i];
        const g = raw[i + 1] ?? raw[i];
        const b = raw[i + 2] ?? raw[i];

        if (r > 240 && g > 240 && b > 240) continue; // ignore white/near-white

        const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b
          .toString(16)
          .padStart(2, "0")}`;
        colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
      }
    }

    if (colorCounts.size === 0) {
      return "#d0d0d0";
    }

    let dominantColor = "#d0d0d0";
    let maxCount = 0;

    for (const [color, count] of colorCounts) {
      if (count > maxCount) {
        dominantColor = color;
        maxCount = count;
      }
    }

    return dominantColor;
  } catch (error) {
    return "#d0d0d0";
  }
};

/**
 * Validate print-ready dimensions
 */
export const validatePrintDimensions = (
  width: number,
  height: number,
  expectedWidth = 2433,
  expectedHeight = 2433,
  tolerance = 5
): { valid: boolean; message: string } => {
  const widthDiff = Math.abs(width - expectedWidth);
  const heightDiff = Math.abs(height - expectedHeight);

  if (widthDiff > tolerance || heightDiff > tolerance) {
    return {
      valid: false,
      message: `Image dimensions ${width}×${height}px do not match expected ${expectedWidth}×${expectedHeight}px (tolerance: ${tolerance}px)`
    };
  }

  return {
    valid: true,
    message: `Image dimensions ${width}×${height}px are print-ready`
  };
};

/**
 * Calculate safe area (content should stay within this area)
 * Safe area = trimmed size - 6mm margin on all sides
 */
export const calculateSafeArea = (dpi = 300) => {
  const trimmedPx = mmToPixels(200, dpi); // 2362px
  const safeMarginPx = mmToPixels(6, dpi); // ~71px

  return {
    trimmedPx,
    safeMarginPx,
    safeWidth: trimmedPx - 2 * safeMarginPx,
    safeHeight: trimmedPx - 2 * safeMarginPx,
    offsetX: safeMarginPx,
    offsetY: safeMarginPx
  };
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) {
    return null;
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }
  return { r, g, b };
};


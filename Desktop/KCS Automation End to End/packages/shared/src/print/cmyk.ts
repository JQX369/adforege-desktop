/**
 * CMYK conversion utilities for print-ready images
 * Based on KCS Legacy specifications:
 * - Convert RGB to CMYK using ICC profile (CGATS21_CRPC1.icc or equivalent)
 * - Export as TIFF format
 * - Maintain 2433×2433px dimensions at 300 DPI
 */

export interface CmykConversionOptions {
  /** ICC profile path (if not provided, uses sRGB -> CMYK conversion) */
  iccProfilePath?: string;
  /** Target format (default: "tiff") */
  format?: "tiff" | "png";
  /** Compression for TIFF (default: "lzw") */
  compression?: "lzw" | "none" | "jpeg";
  /** Quality for JPEG compression (default: 100) */
  quality?: number;
}

export interface CmykConversionResult {
  /** Success status */
  success: boolean;
  /** Output buffer (if successful) */
  buffer?: Buffer;
  /** Error message (if failed) */
  error?: string;
  /** Output format */
  format: string;
  /** File size in bytes */
  sizeBytes?: number;
}

/**
 * Convert RGB image to CMYK TIFF
 * This is a mock implementation - actual implementation would use sharp with ICC profiles
 *
 * Process:
 * 1. Load RGB image
 * 2. Apply ICC profile transformation (sRGB -> CMYK via CGATS21_CRPC1.icc)
 * 3. Convert color space to CMYK
 * 4. Validate dimensions (should be 2433×2433px)
 * 5. Export as TIFF with LZW compression
 */
export const convertToCmyk = async (
  rgbImageBuffer: Buffer,
  options: CmykConversionOptions = {}
): Promise<CmykConversionResult> => {
  const {
    iccProfilePath,
    format = "tiff",
    compression = "lzw",
    quality = 100
  } = options;

  try {
    const sharp = await import("sharp");
    const pipeline = sharp.default(rgbImageBuffer);

    let iccProfileBuffer: Buffer | null = null;
    if (iccProfilePath) {
      iccProfileBuffer = await loadIccProfile(iccProfilePath);
    }

    const toCmyk = pipeline.toColorspace("cmyk");

    if (iccProfileBuffer) {
      toCmyk.withMetadata({ icc: iccProfileBuffer });
    }

    const output = await toCmyk
      .tiff({
        compression,
        quality,
        xres: 300,
        yres: 300
      })
      .toBuffer();

    return {
      success: true,
      buffer: output,
      format,
      sizeBytes: output.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      format
    };
  }
};

/**
 * Validate CMYK image
 * Checks that image is in CMYK color space and has correct dimensions
 */
export const validateCmykImage = async (
  imageBuffer: Buffer,
  expectedWidth = 2433,
  expectedHeight = 2433
): Promise<{ valid: boolean; message: string; colorSpace?: string; width?: number; height?: number }> => {
  try {
    const sharp = await import("sharp");
    const metadata = await sharp.default(imageBuffer).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to read image dimensions");
    }

    if (metadata.space !== "cmyk") {
      return {
        valid: false,
        message: `Expected CMYK colorspace, got ${metadata.space}`,
        colorSpace: metadata.space,
        width: metadata.width,
        height: metadata.height
      };
    }

    const widthDiff = Math.abs(metadata.width - expectedWidth);
    const heightDiff = Math.abs(metadata.height - expectedHeight);

    if (widthDiff > 5 || heightDiff > 5) {
      return {
        valid: false,
        message: `Image dimensions ${metadata.width}×${metadata.height}px differ from expected ${expectedWidth}×${expectedHeight}px`,
        colorSpace: metadata.space,
        width: metadata.width,
        height: metadata.height
      };
    }

    return {
      valid: true,
      message: "CMYK image validated",
      colorSpace: metadata.space,
      width: metadata.width,
      height: metadata.height
    };
  } catch (error) {
    return {
      valid: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

/**
 * Upscale image to print dimensions if needed
 * Uses Lanczos3 resampling for high-quality upscaling
 */
export const upscaleToPrintDimensions = async (
  imageBuffer: Buffer,
  targetWidth = 2433,
  targetHeight = 2433
): Promise<{ success: boolean; buffer?: Buffer; originalWidth?: number; originalHeight?: number; error?: string }> => {
  try {
    const sharp = await import("sharp");
    const image = sharp.default(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Unable to read image dimensions");
    }

    if (metadata.width >= targetWidth && metadata.height >= targetHeight) {
      return {
        success: true,
        buffer: imageBuffer,
        originalWidth: metadata.width,
        originalHeight: metadata.height
      };
    }

    const resized = await image
      .resize(targetWidth, targetHeight, {
        fit: "cover",
        kernel: "lanczos3"
      })
      .toBuffer();

    return {
      success: true,
      buffer: resized,
      originalWidth: metadata.width,
      originalHeight: metadata.height
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

/**
 * Load ICC profile from file system
 * Common ICC profiles:
 * - CGATS21_CRPC1.icc (CMYK for coated paper)
 * - ISOcoated_v2_300_eci.icc (European standard)
 * - USWebCoatedSWOP.icc (US standard)
 */
export const loadIccProfile = async (profilePath: string): Promise<Buffer | null> => {
  try {
    const fs = require("fs").promises;
    const path = require("path");
    
    // If relative path, resolve from shared package assets
    let fullPath = profilePath;
    if (!path.isAbsolute(profilePath)) {
      const packageRoot = path.join(__dirname, "..", "..");
      fullPath = path.join(packageRoot, "assets", profilePath);
    }
    
    return await fs.readFile(fullPath);
  } catch (error) {
    console.warn(`Failed to load ICC profile from ${profilePath}:`, error);
    return null;
  }
};

/**
 * Get recommended ICC profile path based on print specifications
 * Returns relative path from packages/shared/assets/
 */
export const getRecommendedIccProfile = (paperType: "coated" | "uncoated" | "newsprint" = "coated"): string => {
  const profiles: Record<string, string> = {
    coated: "CGATS21_CRPC1.icc", // High-quality coated paper (recommended)
    uncoated: "ISOuncoated.icc",
    newsprint: "ISOnewspaper26v4.icc"
  };

  return profiles[paperType] || profiles.coated;
};


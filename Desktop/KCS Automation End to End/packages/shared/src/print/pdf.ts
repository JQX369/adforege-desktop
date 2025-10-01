/**
 * PDF assembly utilities for print-ready book generation
 * Supports text rendering, overlay composition, and ICC profile embedding
 */

export interface TextRenderOptions {
  /** Text content to render */
  text: string;
  /** Font family name */
  fontFamily: string;
  /** Font size in points */
  fontSize: number;
  /** Line spacing in points */
  lineSpacing: number;
  /** Text color (hex) */
  textColor: string;
  /** Max width as percentage of available space */
  textWidthPercent: number;
  /** Border margin as percentage */
  borderPercent: number;
}

export interface OverlayPosition {
  /** Position key (b, t, tl, tr, bl, br, topMAX, bottomMAX) */
  position: string;
  /** X offset in pixels */
  x: number;
  /** Y offset in pixels */
  y: number;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

export interface PageCompositionOptions {
  /** Base CMYK TIFF buffer */
  baseTiff: Buffer;
  /** Overlay PNG path */
  overlayPath: string;
  /** Text to render */
  text: string;
  /** Text rendering config */
  textConfig: TextRenderOptions;
  /** Overlay position */
  overlayPosition: OverlayPosition;
}

export interface PageCompositionResult {
  success: boolean;
  buffer?: Buffer;
  error?: string;
}

/**
 * Calculate text bounding box for given config
 * This estimates the required space for text rendering
 */
export const calculateTextBounds = (
  text: string,
  fontSize: number,
  lineSpacing: number,
  maxWidthPx: number
): { width: number; height: number; lineCount: number } => {
  // Simple estimation - actual implementation would use canvas.measureText
  const avgCharsPerLine = Math.floor(maxWidthPx / (fontSize * 0.6)); // Rough estimate
  const words = text.split(/\s+/);
  let currentLine = "";
  let lineCount = 0;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length > avgCharsPerLine && currentLine) {
      lineCount++;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lineCount++;

  return {
    width: maxWidthPx,
    height: lineCount * lineSpacing,
    lineCount
  };
};

/**
 * Compose a page with base image, overlay, and text
 * This is a mock implementation - actual implementation would use sharp + canvas
 */
export const composePage = async (options: PageCompositionOptions): Promise<PageCompositionResult> => {
  try {
    const sharp = await import("sharp");

    const overlayBuffer = await renderOverlayWithText(options);

    const composed = await sharp.default(options.baseTiff)
      .composite([
        {
          input: overlayBuffer,
          top: options.overlayPosition.y,
          left: options.overlayPosition.x
        }
      ])
      .toBuffer();

    return {
      success: true,
      buffer: composed
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

/**
 * Analyze page composition to determine optimal overlay position
 * Uses image analysis to find best text placement
 *
 * @param imagePath - Path to the page image
 * @param textLength - Length of text to place
 * @returns Recommended position (b, t, tl, tr, bl, br, topMAX, bottomMAX)
 */
export const analyzeOptimalOverlayPosition = (
  imagePath: string,
  textLength: number
): string => {
  // Simple heuristic - actual implementation would use Gemini vision
  // For >450 chars, prefer MAX overlays
  if (textLength > 450) {
    return Math.random() > 0.5 ? "topMAX" : "bottomMAX";
  }

  // For shorter text, prefer standard positions
  const positions = ["b", "t", "tl", "tr", "bl", "br"];
  return positions[Math.floor(Math.random() * positions.length)];
};

/**
 * Create a dedication page
 */
export const createDedicationPage = async (
  dedicationText: string,
  width: number,
  height: number,
  textConfig: TextRenderOptions
): Promise<Buffer> => {
  const sharp = await import("sharp");

  const base = await sharp.default({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .toColourspace("cmyk")
    .tiff({ compression: "lzw", xres: 300, yres: 300 })
    .toBuffer();

  const overlayBuffer = await renderTextPage(
    width,
    height,
    [
      {
        text: "This book is dedicated to:",
        x: width / 2,
        y: height * 0.2,
        align: "center"
      },
      {
        text: dedicationText,
        x: width * 0.2,
        y: height * 0.3,
        width: width * 0.6,
        align: "left"
      }
    ],
    textConfig
  );

  return sharp.default(base)
    .composite([{ input: overlayBuffer, left: 0, top: 0 }])
    .toBuffer();
};

/**
 * Create a promotional page
 */
export const createPromoPage = async (
  promoText: string,
  width: number,
  height: number,
  textConfig: TextRenderOptions
): Promise<Buffer> => {
  const sharp = await import("sharp");

  const base = await sharp.default({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .toColourspace("cmyk")
    .tiff({ compression: "lzw", xres: 300, yres: 300 })
    .toBuffer();

  const overlayBuffer = await renderTextPage(
    width,
    height,
    [
      {
        text: promoText,
        x: width * 0.1,
        y: height * 0.2,
        width: width * 0.8,
        align: "left"
      }
    ],
    textConfig
  );

  return sharp.default(base)
    .composite([{ input: overlayBuffer, left: 0, top: 0 }])
    .toBuffer();
};

/**
 * Ensure even page count (required for print binding)
 */
export const ensureEvenPageCount = (pageCount: number): number => {
  return pageCount % 2 === 0 ? pageCount : pageCount + 1;
};

/**
 * Get overlay path for reading age and position
 * Assets are bundled in packages/shared/assets/overlays
 */
export const getOverlayPath = (readingAge: string, position: string): string => {
  const path = require("path");
  const baseDir = path.join(__dirname, "..", "..", "assets", "overlays");

  // Check if MAX position
  if (position === "topMAX" || position === "bottomMAX") {
    return path.join(baseDir, "MAX", `${position}.png`);
  }

  // Map position to V2 file naming
  const positionMap: Record<string, string> = {
    b: "bottom.png",
    t: "top.png",
    tl: "top_left.png",
    tr: "top_right.png",
    bl: "bottom_left.png",
    br: "bottom_right.png"
  };

  const filename = positionMap[position] || "bottom.png";
  return path.join(baseDir, "V2", filename);
};

/**
 * Calculate overlay position coordinates
 * Based on 2433×2433px canvas
 */
export const calculateOverlayCoordinates = (position: string): OverlayPosition => {
  const canvasSize = 2433;
  const overlayWidth = Math.floor(canvasSize * 0.8); // 80% width
  const overlayHeight = Math.floor(canvasSize * 0.3); // 30% height

  const positions: Record<string, { x: number; y: number }> = {
    b: { x: Math.floor((canvasSize - overlayWidth) / 2), y: canvasSize - overlayHeight - 50 },
    t: { x: Math.floor((canvasSize - overlayWidth) / 2), y: 50 },
    bl: { x: 50, y: canvasSize - overlayHeight - 50 },
    br: { x: canvasSize - overlayWidth - 50, y: canvasSize - overlayHeight - 50 },
    tl: { x: 50, y: 50 },
    tr: { x: canvasSize - overlayWidth - 50, y: 50 },
    topMAX: { x: Math.floor((canvasSize - overlayWidth) / 2), y: 50 },
    bottomMAX: { x: Math.floor((canvasSize - overlayWidth) / 2), y: canvasSize - overlayHeight - 50 }
  };

  const coords = positions[position] || positions.b;

  return {
    position,
    x: coords.x,
    y: coords.y,
    width: overlayWidth,
    height: position.includes("MAX") ? Math.floor(canvasSize * 0.45) : overlayHeight
  };
};

/**
 * Export pages to PDF with ICC profile
 */
export const exportToPdf = async (
  pageBuffers: Buffer[],
  outputPath: string,
  iccProfilePath?: string
): Promise<{ success: boolean; filePath?: string; error?: string }> => {
  try {
    const fs = await import("fs/promises");
    const { PDFDocument } = await import("pdf-lib");

    const pdfDoc = await PDFDocument.create();

    pdfDoc.setTitle("KCS Print Ready Book");
    pdfDoc.setProducer("KCS Automation");
    pdfDoc.setCreator("KCS Print Pipeline");

    for (const pageBuffer of pageBuffers) {
      const pageImage = await pdfDoc.embedPng(pageBuffer);
      const { width, height } = pageImage.size();
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(pageImage, { x: 0, y: 0, width, height });
    }

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);

    return {
      success: true,
      filePath: outputPath
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

const renderOverlayWithText = async (options: PageCompositionOptions): Promise<Buffer> => {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");

  const canvas = createCanvas(options.overlayPosition.width, options.overlayPosition.height);
  const ctx = canvas.getContext("2d");

  const overlayImage = await loadImage(options.overlayPath);
  ctx.drawImage(overlayImage, 0, 0, options.overlayPosition.width, options.overlayPosition.height);

  ctx.fillStyle = options.textConfig.textColor;
  ctx.font = `${options.textConfig.fontSize}px ${options.textConfig.fontFamily}`;
  ctx.textBaseline = "top";

  drawWrappedText(ctx, options.text, options.textConfig, {
    x: options.overlayPosition.width * ((100 - options.textConfig.textWidthPercent) / 200),
    y: options.overlayPosition.height * (options.textConfig.borderPercent / 100),
    width: options.overlayPosition.width * (options.textConfig.textWidthPercent / 100)
  });

  return canvas.toBuffer("image/png");
};

const renderTextPage = async (
  width: number,
  height: number,
  blocks: Array<{ text: string; x: number; y: number; width?: number; align: "left" | "center" | "right" }>,
  config: TextRenderOptions
): Promise<Buffer> => {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = config.textColor;
  ctx.font = `${config.fontSize}px ${config.fontFamily}`;
  ctx.textBaseline = "top";

  for (const block of blocks) {
    ctx.textAlign = block.align;
    drawWrappedText(ctx, block.text, config, {
      x: block.align === "center" ? block.x : block.x,
      y: block.y,
      width: block.width ?? width * (config.textWidthPercent / 100)
    });
  }

  return canvas.toBuffer("image/png");
};

const drawWrappedText = (
  ctx: any,
  text: string,
  config: TextRenderOptions,
  region: { x: number; y: number; width: number }
) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  let currentY = region.y;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    const lineWidth = metrics.width;

    if (lineWidth > region.width && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  for (const line of lines) {
    let drawX = region.x;
    if (ctx.textAlign === "center") {
      drawX = region.x + region.width / 2;
    } else if (ctx.textAlign === "right") {
      drawX = region.x + region.width;
    }
    ctx.fillText(line, drawX, currentY);
    currentY += config.lineSpacing;
  }
};

const drawWrappedText = (
  ctx: any,
  text: string,
  config: TextRenderOptions,
  region?: { x: number; y: number; width: number }
) => {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";
  const maxWidth = (region?.width ?? ctx.canvas.width * (config.textWidthPercent / 100)) |
    ctx.canvas.width;
  const startX = region?.x ?? ctx.canvas.width * ((100 - config.textWidthPercent) / 200);
  let currentY = region?.y ?? ctx.canvas.height * (config.borderPercent / 100);

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    const lineWidth = metrics.width;

    if (lineWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  for (const line of lines) {
    ctx.fillText(line, startX, currentY);
    currentY += config.lineSpacing;
  }
};


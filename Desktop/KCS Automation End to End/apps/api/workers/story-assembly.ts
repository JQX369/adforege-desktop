import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import {
  logger,
  composePage,
  calculateOverlayCoordinates,
  getOverlayPath,
  createDedicationPage,
  createPromoPage,
  ensureEvenPageCount,
  exportToPdf
} from "@kcs/shared";
import { recordJobMetrics, recordPrintAssemblyMetrics } from "../lib/metrics";
import {
  ImageProviderRegistry,
  createImageClient,
  GeminiImageProvider,
  OpenAIImageProvider,
  buildOverlayPositionPrompt
} from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { getStoryStorageAdapter } from "../lib/story/storage";
import { getPrintSettingsForOrder } from "../lib/print";

interface StoryAssemblyJobData {
  orderId: string;
}

// Initialize image providers globally
const registry = new ImageProviderRegistry();
registry.register(new GeminiImageProvider(process.env.GEMINI_API_KEY || ""));
registry.register(new OpenAIImageProvider(process.env.OPENAI_API_KEY || ""));

const createDynamicImageClient = (modelPrefs: any) => {
  return createImageClient(registry, {
    primary: "gemini-flash",
    fallback: "openai-image",
    models: {
      default: modelPrefs?.default || "gemini-2.5-flash-002",
      overlay_position: modelPrefs?.overlay_position || "gemini-2.5-flash-002"
    }
  });
};

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const storyAssemblyWorker = new Worker<StoryAssemblyJobData>(
  "story.assembly",
  async (job) => {
    const startTime = Date.now();
    const { orderId } = job.data;

    try {
      logger.info({ orderId, jobId: job.id }, "Starting book assembly");

      const story = await prisma.story.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              brief: true,
              partner: true
            }
          }
        }
      });

      if (!story) {
        throw new Error(`Story not found for order ${orderId}`);
      }

      const metadata = (story.printMetadata as any) || {};
      const cmykInterior = (metadata.cmykInterior as string[]) || [];
      const brief = story.order.brief;
      const assetPlan = story.assetPlan as StoryAssetPlan | null;

      if (cmykInterior.length === 0) {
        throw new Error(`No CMYK interior images found for order ${orderId}`);
      }

      // Load print configuration for this reading age
      const readingAge = brief?.readingLevel || "6-7";
      const printConfig = await prisma.printConfig.findFirst({
        where: {
          OR: [
            { partnerId: story.order.partnerId, readingAge },
            { partnerId: null, readingAge, isDefault: true }
          ]
        },
        orderBy: {
          partnerId: "desc" // Prefer partner-specific config
        }
      });

      if (!printConfig) {
        logger.warn({ orderId, readingAge }, "No print config found, using defaults");
      }

      const textConfig = {
        fontFamily: printConfig?.fontFamily || "Arial",
        fontSize: printConfig?.fontSize || 100,
        lineSpacing: printConfig?.lineSpacing || 110,
        textColor: printConfig?.textColor || "#000000",
        textWidthPercent: printConfig?.textWidthPercent || 80,
        borderPercent: printConfig?.borderPercent || 5
      };

      // Create image client with dynamic model selection
      const imageModelPrefs = (printConfig?.imageModelPreferences as any) ?? {
        default: "gemini-2.5-flash-002",
        overlay_position: "gemini-2.5-flash-002"
      };
      const imageClient = createDynamicImageClient(imageModelPrefs);

      logger.info(
        { orderId, readingAge, fontSize: textConfig.fontSize, pageCount: cmykInterior.length, models: imageModelPrefs },
        "Loaded print config"
      );

      // Split story text into paragraphs (one per page)
      const paragraphs = story.finalText
        ?.split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .slice(0, cmykInterior.length) || [];

      const composedPages: Buffer[] = [];

      // Page 1: Dedication page
      if (brief?.extractedJson?.dedication) {
        logger.info({ orderId }, "Creating dedication page");
        const dedicationPage = await createDedicationPage(
          brief.extractedJson.dedication,
          2433,
          2433,
          textConfig as any
        );
        composedPages.push(dedicationPage);
      }

      // Interior story pages
      for (let i = 0; i < cmykInterior.length; i++) {
        const pageNumber = i + 1;
        const cmykUrl = cmykInterior[i];
        const pageText = paragraphs[i] || "";

        logger.info({ orderId, pageNumber }, `Assembling page ${pageNumber}`);

        try {
          // Download CMYK TIFF
          const cmykBuffer = await downloadImage(cmykUrl);

          // Determine overlay position
          let overlayPosition = "b"; // Default to bottom

          const aiPlacementEnabled = printConfig?.overlayPreferences?.aiPlacementEnabled ?? true;

          if (aiPlacementEnabled && pageText.length > 0) {
            try {
              // Use Gemini vision to analyze composition
              const positionPrompt = buildOverlayPositionPrompt(cmykUrl, pageText.length);
              const visionResponse = await imageClient.analyzeImages("overlay_position", [cmykUrl], positionPrompt);

              // Parse position from response (look for position keyword)
              const positionMatch = visionResponse.output.match(/\b(bottom|top|topMAX|bottomMAX|top_left|top_right|bottom_left|bottom_right|b|t|tl|tr|bl|br)\b/i);
              if (positionMatch) {
                overlayPosition = positionMatch[1].toLowerCase();
                logger.info({ orderId, pageNumber, overlayPosition }, "AI-selected overlay position");
              }
            } catch (error) {
              logger.warn({ orderId, pageNumber, error }, "AI placement failed, using default");
            }
          }

          // Get overlay path for reading age
          const overlayPath = getOverlayPath(readingAge, overlayPosition);
          const overlayCoords = calculateOverlayCoordinates(overlayPosition);

          // Compose page with overlay and text
          const compositionResult = await composePage({
            baseTiff: cmykBuffer,
            overlayPath,
            text: pageText,
            textConfig: textConfig as any,
            overlayPosition: overlayCoords
          });

          if (!compositionResult.success || !compositionResult.buffer) {
            throw new Error(`Page composition failed: ${compositionResult.error}`);
          }

          composedPages.push(compositionResult.buffer);
          logger.info({ orderId, pageNumber, overlayPosition }, `Page ${pageNumber} assembled`);
        } catch (error) {
          logger.error({ orderId, pageNumber, error }, `Failed to assemble page ${pageNumber}`);
          throw error;
        }
      }

      // Add promo page
      logger.info({ orderId }, "Creating promo page");
      const promoPage = await createPromoPage(
        "Visit KidsCustomStories.com for more personalized adventures!",
        2433,
        2433,
        textConfig as any
      );
      composedPages.push(promoPage);

      // Ensure even page count
      const targetPageCount = ensureEvenPageCount(composedPages.length);
      if (composedPages.length < targetPageCount) {
        logger.info({ orderId, currentPages: composedPages.length, targetPages: targetPageCount }, "Adding blank page");
        const blankPage = Buffer.from("mock-blank-page");
        composedPages.push(blankPage);
      }

      logger.info({ orderId, totalPages: composedPages.length }, "Exporting to PDF");

      // Export to PDF with ICC profile
      const pdfFilename = `${orderId}-inside-book.pdf`;
      const exportResult = await exportToPdf(
        composedPages,
        pdfFilename,
        printConfig?.iccProfilePath || undefined
      );

      if (!exportResult.success || !exportResult.filePath) {
        throw new Error(`PDF export failed: ${exportResult.error}`);
      }

      // Upload PDF to storage
      const fs = await import("fs/promises");
      const pdfBuffer = await fs.readFile(exportResult.filePath);
      
      const storage = getStoryStorageAdapter();
      const pdfUploadResult = await storage.uploadBuffer(pdfBuffer, `print/${orderId}/inside-book.pdf`, {
        contentType: "application/pdf",
        cacheControl: "public, max-age=31536000"
      });
      const pdfUrl = pdfUploadResult.url;

      // Clean up local file
      await fs.unlink(exportResult.filePath).catch(() => {});

      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: "assembled",
          printMetadata: {
            ...metadata,
            insideBookPdf: pdfUrl
          }
        }
      });

      logger.info({ orderId, pdfUrl, totalPages: composedPages.length }, "Book assembly complete");
      
      const totalDuration = Date.now() - startTime;
      recordJobMetrics("story.assembly", "success", totalDuration);
      recordPrintAssemblyMetrics(composedPages.length, totalDuration);

      // Chain to final handoff
      await queues.storyHandoff.add("story.handoff", { orderId });
    } catch (error) {
      logger.error({ orderId, error }, "Book assembly failed");
      recordJobMetrics("story.assembly", "failure", Date.now() - startTime);
      throw error;
    }
  },
  { connection: redisConnection }
);


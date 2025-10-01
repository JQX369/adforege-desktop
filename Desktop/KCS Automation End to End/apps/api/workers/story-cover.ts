import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { logger } from "@kcs/shared";
import { recordJobMetrics, recordPrintCoverMetrics } from "../lib/metrics";
import {
  ImageProviderRegistry,
  createImageClient,
  GeminiImageProvider,
  OpenAIImageProvider,
  buildCoverFrontPrompt,
  buildCoverBackPrompt
} from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import {
  composeCoverSpread,
  calculateCoverSpreadDimensions,
  generateOrderBadge,
  convertToCmyk
} from "@kcs/shared";
import { getStoryStorageAdapter } from "../lib/story/storage";
import { getPrintSettingsForOrder } from "../lib/print";
import { loadAssetAsBuffer } from "../lib/storage-utils";

interface StoryCoverJobData {
  orderId: string;
}

// Initialize image providers globally
const registry = new ImageProviderRegistry();
registry.register(new GeminiImageProvider(process.env.GEMINI_API_KEY || ""));
registry.register(new OpenAIImageProvider(process.env.OPENAI_API_KEY || ""));

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const createDynamicImageClient = (modelPrefs: any) => {
  return createImageClient(registry, {
    primary: "gemini-flash",
    fallback: "openai-image",
    models: {
      default: modelPrefs?.default || "imagen-3-fast-001",
      cover_front: modelPrefs?.cover_front || "imagen-3-fast-001",
      cover_back: modelPrefs?.cover_back || "imagen-3-fast-001"
    }
  });
};

export const storyCoverWorker = new Worker<StoryCoverJobData>(
  "story.cover",
  async (job) => {
    const startTime = Date.now();
    const { orderId } = job.data;

    try {
      logger.info({ orderId, jobId: job.id }, "Starting cover generation");

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

      const assetPlan = story.assetPlan as StoryAssetPlan | null;
      const brief = story.order.brief;

      if (!assetPlan || !brief) {
        throw new Error(`Missing assetPlan or brief for order ${orderId}`);
      }

      // Extract cover context
      const title = brief.extractedJson?.title || "Untitled Story";
      const blurb = assetPlan.blurb || "An amazing adventure awaits!";
      const mainCharacterName = brief.extractedJson?.mainCharacter?.name || "Hero";
      const mainCharacterDescription =
        assetPlan.mainCharacterDescriptor || "A brave young adventurer";
      const stylePrompt = assetPlan.visionDescriptors?.style || "Vibrant children's book illustration";
      const readingAge = brief.readingLevel || "6-8";

      const coverContext = {
        title,
        blurb,
        mainCharacterName,
        mainCharacterDescription,
        stylePrompt,
        readingAge
      };

      // Load print settings for this order (includes imageModelPreferences)
      const printSettings = await getPrintSettingsForOrder(orderId, readingAge);
      const imageClient = createDynamicImageClient(printSettings.imageModelPreferences);

      logger.info({ orderId, title, readingAge, models: printSettings.imageModelPreferences }, "Generating front cover");

      // Generate front cover
      const frontCoverPrompt = buildCoverFrontPrompt(coverContext);
      const frontCoverResponse = await imageClient.generateImage("cover_front", frontCoverPrompt, {
        width: 2433,
        height: 2433
      });

      // Handle base64 image data from Gemini
      const storage = getStoryStorageAdapter();
      let frontCoverUrl = frontCoverResponse.imageUrl;

      if (frontCoverResponse.imageBase64 && !frontCoverUrl) {
        const frontBuffer = Buffer.from(frontCoverResponse.imageBase64, "base64");
        const frontUpload = await storage.uploadBuffer(frontBuffer, `print/${orderId}/covers/front-rgb.png`, {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000"
        });
        frontCoverUrl = frontUpload.url;
        logger.info({ orderId, frontCoverUrl }, "Front cover uploaded from base64");
      }

      logger.info({ orderId, imageUrl: frontCoverUrl }, "Front cover generated");

      // Generate back cover
      logger.info({ orderId }, "Generating back cover");
      const backCoverPrompt = buildCoverBackPrompt(coverContext);
      const backCoverResponse = await imageClient.generateImage("cover_back", backCoverPrompt, {
        width: 2433,
        height: 2433
      });

      let backCoverUrl = backCoverResponse.imageUrl;

      if (backCoverResponse.imageBase64 && !backCoverUrl) {
        const backBuffer = Buffer.from(backCoverResponse.imageBase64, "base64");
        const backUpload = await storage.uploadBuffer(backBuffer, `print/${orderId}/covers/back-rgb.png`, {
          contentType: "image/png",
          cacheControl: "public, max-age=31536000"
        });
        backCoverUrl = backUpload.url;
        logger.info({ orderId, backCoverUrl }, "Back cover uploaded from base64");
      }

      logger.info({ orderId, imageUrl: backCoverUrl }, "Back cover generated");

      // Convert covers to CMYK for spread composition
      logger.info({ orderId }, "Converting covers to CMYK for spread");

      const frontRgbBuffer = await downloadImage(frontCoverUrl);
      const backRgbBuffer = await downloadImage(backCoverUrl);

      const frontCmykResult = await convertToCmyk(frontRgbBuffer, {
        format: "tiff",
        compression: "lzw",
        quality: 100
      });

      const backCmykResult = await convertToCmyk(backRgbBuffer, {
        format: "tiff",
        compression: "lzw",
        quality: 100
      });

      if (!frontCmykResult.success || !frontCmykResult.buffer || !backCmykResult.success || !backCmykResult.buffer) {
        throw new Error("Failed to convert covers to CMYK");
      }

      // Upload CMYK covers
      const frontCmykUpload = await storage.uploadBuffer(frontCmykResult.buffer, `print/${orderId}/covers/front-cmyk.tif`, {
        contentType: "image/tiff",
        cacheControl: "public, max-age=31536000"
      });
      const backCmykUpload = await storage.uploadBuffer(backCmykResult.buffer, `print/${orderId}/covers/back-cmyk.tif`, {
        contentType: "image/tiff",
        cacheControl: "public, max-age=31536000"
      });

      const frontCmykUrl = frontCmykUpload.url;
      const backCmykUrl = backCmykUpload.url;

      logger.info({ orderId, frontCmykUrl, backCmykUrl }, "Cover CMYK conversion complete");

      // Compose cover spread (Phase 6.6)
      logger.info({ orderId }, "Composing cover spread");

      // Get page count estimate from metadata or default
      const pageCountEstimate = 24; // Default, will be updated after interior generation

      const spreadDimensions = calculateCoverSpreadDimensions(pageCountEstimate);

      // Generate order badge
      const orderBadge = await generateOrderBadge(orderId.substring(0, 8));

      // Compose spread
      const spreadResult = await composeCoverSpread({
        frontCoverTiff: frontCmykResult.buffer,
        backCoverTiff: backCmykResult.buffer,
        title,
        blurb,
        characterName: mainCharacterName,
        titleFontFamily: "Arial",
        titleFontSize: 120,
        textColor: "#000000",
        orderBadge
        // TODO: Load splashImage from KCS Prop Files/elements/
      });

      if (!spreadResult.success || !spreadResult.buffer) {
        logger.warn({ orderId, error: spreadResult.error }, "Cover spread composition failed, will skip");
      }

      let coverSpreadUrl: string | null = null;

      if (spreadResult.success && spreadResult.buffer) {
        const spreadUpload = await storage.uploadBuffer(spreadResult.buffer, `print/${orderId}/cover-spread.pdf`, {
          contentType: "application/pdf",
          cacheControl: "public, max-age=31536000"
        });
        coverSpreadUrl = spreadUpload.url;
        logger.info({ orderId, coverSpreadUrl, width: spreadResult.width, height: spreadResult.height }, "Cover spread composed");
      }

      const printMetadata = {
        coverFront: frontCoverUrl,
        coverBack: backCoverUrl,
        coverFrontCmyk: frontCmykUrl,
        coverBackCmyk: backCmykUrl,
        coverSpread: coverSpreadUrl,
        interiorImages: [],
        cmykCovers: [frontCmykUrl, backCmykUrl],
        cmykInterior: [],
        insideBookPdf: null
      };

      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: "cover_generated",
          printMetadata: printMetadata
        }
      });

      logger.info({ orderId, provider: frontCoverResponse.provider, hasCoverSpread: !!coverSpreadUrl }, "Cover generation complete");
      
      const totalDuration = Date.now() - startTime;
      recordJobMetrics("story.cover", "success", totalDuration);
      recordPrintCoverMetrics(frontCoverResponse.provider, totalDuration);

      // Trigger interior generation
      await queues.storyInterior.add("story.interior", { orderId });
    } catch (error) {
      logger.error({ orderId, error }, "Cover generation failed");
      recordJobMetrics("story.cover", "failure", Date.now() - startTime);
      throw error;
    }
  },
  { connection: redisConnection }
);


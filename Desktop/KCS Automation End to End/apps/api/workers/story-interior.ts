import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { logger } from "@kcs/shared";
import { recordJobMetrics, recordPrintInteriorMetrics } from "../lib/metrics";
import {
  ImageProviderRegistry,
  createImageClient,
  GeminiImageProvider,
  OpenAIImageProvider,
  buildInteriorPagePrompt,
  buildVisionScorePrompt
} from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { getPrintSettingsForOrder } from "../lib/print";
import { getStoryStorageAdapter } from "../lib/story/storage";

interface StoryInteriorJobData {
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
      default: modelPrefs?.default || "imagen-3-fast-001",
      interior_page: modelPrefs?.interior_page || "imagen-3-fast-001",
      vision_score: modelPrefs?.vision_score || "gemini-2.5-flash-002"
    }
  });
};

export const storyInteriorWorker = new Worker<StoryInteriorJobData>(
  "story.interior",
  async (job) => {
    const startTime = Date.now();
    const { orderId } = job.data;

    try {
      logger.info({ orderId, jobId: job.id }, "Starting interior image generation");

      const story = await prisma.story.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              brief: true
            }
          }
        }
      });

      if (!story) {
        throw new Error(`Story not found for order ${orderId}`);
      }

      const assetPlan = story.assetPlan as StoryAssetPlan | null;
      const brief = story.order.brief;

      if (!assetPlan || !story.finalText) {
        throw new Error(`Missing assetPlan or finalText for order ${orderId}`);
      }

      // Split story into paragraphs (simple split for now)
      const paragraphs = story.finalText
        .split(/\n\n+/)
        .filter((p) => p.trim().length > 0)
        .slice(0, 24); // Max 24 interior pages

      const stylePrompt = assetPlan.visionDescriptors?.style || "Vibrant children's book illustration";
      const readingAge = brief?.readingLevel || "6-8";

      // Load print settings for dynamic model selection
      const printSettings = await getPrintSettingsForOrder(orderId, readingAge);
      const imageClient = createDynamicImageClient(printSettings.imageModelPreferences);
      const storage = getStoryStorageAdapter();

      logger.info({ orderId, paragraphCount: paragraphs.length, models: printSettings.imageModelPreferences }, "Generating interior pages");

      const interiorImages: string[] = [];
      const candidatesPerPage = 2; // Generate 2 candidates per page, pick best

      for (let i = 0; i < paragraphs.length; i++) {
        const pageNumber = i + 1;
        const paragraphText = paragraphs[i];

        logger.info({ orderId, pageNumber }, `Generating page ${pageNumber}`);

        // Build context for this page
        const pageContext = {
          pageNumber,
          paragraphText,
          charactersPresent: [
            {
              name: brief?.extractedJson?.mainCharacter?.name || "Hero",
              description: assetPlan.mainCharacterDescriptor || "Main character"
            }
          ],
          setting: "Story scene",
          stylePrompt,
          readingAge
        };

        const pagePrompt = buildInteriorPagePrompt(pageContext);

        // Generate multiple candidates
        const candidateUrls: string[] = [];
        for (let c = 0; c < candidatesPerPage; c++) {
          try {
            const response = await imageClient.generateImage("interior_page", pagePrompt, {
              width: 2433,
              height: 2433
            });

            let candidateUrl = response.imageUrl;

            // Handle base64 image data from Gemini
            if (response.imageBase64 && !candidateUrl) {
              const imageBuffer = Buffer.from(response.imageBase64, "base64");
              const uploadResult = await storage.uploadBuffer(
                imageBuffer,
                `print/${orderId}/interior/page-${pageNumber}-candidate-${c}.png`,
                { contentType: "image/png", cacheControl: "public, max-age=31536000" }
              );
              candidateUrl = uploadResult.url;
              logger.info({ orderId, pageNumber, candidate: c, url: candidateUrl }, "Candidate uploaded from base64");
            }

            candidateUrls.push(candidateUrl);
          } catch (error) {
            logger.warn({ orderId, pageNumber, candidate: c, error }, "Candidate generation failed");
          }
        }

        if (candidateUrls.length === 0) {
          throw new Error(`Failed to generate any candidates for page ${pageNumber}`);
        }

        // Use vision scoring to pick best candidate
        let selectedUrl = candidateUrls[0];

        if (candidateUrls.length > 1) {
          try {
            const scoringPrompt = buildVisionScorePrompt(
              candidateUrls,
              `Evaluate quality for page ${pageNumber} of a ${readingAge} book. Scene: "${paragraphText.substring(0, 100)}..."`
            );

            const visionResponse = await imageClient.analyzeImages("vision_score", candidateUrls, scoringPrompt);

            // Parse score (simple heuristic: look for "Image N" with highest score)
            const scoreMatches = visionResponse.output.match(/Image (\d+):\s*(\d+(?:\.\d+)?)/g);
            if (scoreMatches && scoreMatches.length > 0) {
              let bestScore = -1;
              let bestIndex = 0;

              scoreMatches.forEach((match) => {
                const [, indexStr, scoreStr] = match.match(/Image (\d+):\s*(\d+(?:\.\d+)?)/) || [];
                const score = parseFloat(scoreStr || "0");
                if (score > bestScore) {
                  bestScore = score;
                  bestIndex = parseInt(indexStr || "1", 10) - 1;
                }
              });

              selectedUrl = candidateUrls[bestIndex] || candidateUrls[0];
              logger.info({ orderId, pageNumber, bestIndex, bestScore }, "Selected best candidate via vision scoring");
            }
          } catch (error) {
            logger.warn({ orderId, pageNumber, error }, "Vision scoring failed, using first candidate");
          }
        }

        interiorImages.push(selectedUrl);
        logger.info({ orderId, pageNumber, imageUrl: selectedUrl }, `Page ${pageNumber} complete`);
      }

      // TODO Phase 6.8: Upscale to final dimensions if needed
      // TODO Phase 6.8: Save to storage adapter

      const currentMetadata = (story.printMetadata as any) || {};

      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: "interior_generated",
          printMetadata: {
            ...currentMetadata,
            interiorImages
          }
        }
      });

      logger.info({ orderId, imageCount: interiorImages.length }, "Interior generation complete");
      
      const totalDuration = Date.now() - startTime;
      recordJobMetrics("story.interior", "success", totalDuration);
      recordPrintInteriorMetrics(interiorImages.length, totalDuration);

      // Chain to CMYK conversion
      await queues.storyCmyk.add("story.cmyk", { orderId });
    } catch (error) {
      logger.error({ orderId, error }, "Interior generation failed");
      recordJobMetrics("story.interior", "failure", Date.now() - startTime);
      throw error;
    }
  },
  { connection: redisConnection }
);


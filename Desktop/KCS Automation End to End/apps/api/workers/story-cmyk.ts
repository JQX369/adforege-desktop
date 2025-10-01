import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import {
  logger,
  convertToCmyk,
  upscaleToPrintDimensions,
  validateCmykImage,
  validatePrintDimensions
} from "@kcs/shared";
import { getStoryStorageAdapter } from "../lib/story/storage";
import { recordJobMetrics, recordPrintCmykMetrics } from "../lib/metrics";

interface StoryCmykJobData {
  orderId: string;
}

const downloadImage = async (url: string): Promise<Buffer> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const storyCmykWorker = new Worker<StoryCmykJobData>(
  "story.cmyk",
  async (job) => {
    const startTime = Date.now();
    const { orderId } = job.data;

    try {
      logger.info({ orderId, jobId: job.id }, "Starting CMYK conversion");

      const story = await prisma.story.findUnique({
        where: { orderId }
      });

      if (!story) {
        throw new Error(`Story not found for order ${orderId}`);
      }

      const metadata = (story.printMetadata as any) || {};
      const coverFront = metadata.coverFront as string | undefined;
      const coverBack = metadata.coverBack as string | undefined;
      const interiorImages = (metadata.interiorImages as string[]) || [];

      if (!coverFront || !coverBack) {
        logger.warn({ orderId }, "Missing cover images, skipping CMYK conversion");
        throw new Error("Missing cover images");
      }

      logger.info({ orderId, imageCount: interiorImages.length + 2 }, "Processing RGB to CMYK conversion");

      // Process cover images
      const cmykCovers: string[] = [];

      for (const [index, coverUrl] of [coverFront, coverBack].entries()) {
        const coverLabel = index === 0 ? "front" : "back";
        logger.info({ orderId, coverLabel }, `Converting ${coverLabel} cover to CMYK`);

        try {
          // Download RGB image
          const rgbBuffer = await downloadImage(coverUrl);

          // Upscale if needed
          const upscaleResult = await upscaleToPrintDimensions(rgbBuffer, 2433, 2433);
          if (!upscaleResult.success || !upscaleResult.buffer) {
            throw new Error(`Upscale failed for ${coverLabel} cover`);
          }

          // Validate dimensions
          const dimValidation = validatePrintDimensions(
            upscaleResult.originalWidth || 2433,
            upscaleResult.originalHeight || 2433
          );
          if (!dimValidation.valid) {
            logger.warn({ orderId, coverLabel, ...upscaleResult }, dimValidation.message);
          }

          // Convert to CMYK TIFF
          const cmykResult = await convertToCmyk(upscaleResult.buffer, {
            format: "tiff",
            compression: "lzw",
            quality: 100,
            iccProfilePath: "KCS Prop Files/assets/CGATS21_CRPC1.icc"
          });

          if (!cmykResult.success || !cmykResult.buffer) {
            throw new Error(`CMYK conversion failed for ${coverLabel} cover: ${cmykResult.error}`);
          }

          // Upload CMYK TIFF
          const storage = getStoryStorageAdapter();
          const uploadKey = `print/${orderId}/covers/${coverLabel}-cmyk.tif`;
          const uploadResult = await storage.uploadBuffer(cmykResult.buffer, uploadKey, {
            contentType: "image/tiff",
            cacheControl: "public, max-age=31536000"
          });
          cmykCovers.push(uploadResult.url);

          logger.info(
            { orderId, coverLabel, cmykUrl, sizeBytes: cmykResult.sizeBytes },
            `${coverLabel} cover CMYK complete`
          );
        } catch (error) {
          logger.error({ orderId, coverLabel, error }, `Failed to convert ${coverLabel} cover`);
          throw error;
        }
      }

      // Process interior images
      const cmykInterior: string[] = [];

      for (const [index, interiorUrl] of interiorImages.entries()) {
        const pageNumber = index + 1;
        logger.info({ orderId, pageNumber }, `Converting interior page ${pageNumber} to CMYK`);

        try {
          const rgbBuffer = await downloadImage(interiorUrl);

          // Upscale
          const upscaleResult = await upscaleToPrintDimensions(rgbBuffer, 2433, 2433);
          if (!upscaleResult.success || !upscaleResult.buffer) {
            logger.warn({ orderId, pageNumber }, `Upscale failed for page ${pageNumber}, using original`);
          }

          // Convert to CMYK
          const cmykResult = await convertToCmyk(upscaleResult.buffer || rgbBuffer, {
            format: "tiff",
            compression: "lzw",
            quality: 100,
            iccProfilePath: "KCS Prop Files/assets/CGATS21_CRPC1.icc"
          });

          if (!cmykResult.success || !cmykResult.buffer) {
            throw new Error(`CMYK conversion failed for page ${pageNumber}: ${cmykResult.error}`);
          }

          // Upload
          const storage = getStoryStorageAdapter();
          const uploadKey = `print/${orderId}/interior/page-${pageNumber}-cmyk.tif`;
          const uploadResult = await storage.uploadBuffer(cmykResult.buffer, uploadKey, {
            contentType: "image/tiff",
            cacheControl: "public, max-age=31536000"
          });
          cmykInterior.push(uploadResult.url);

          if ((index + 1) % 5 === 0) {
            logger.info({ orderId, pagesComplete: index + 1, totalPages: interiorImages.length }, "CMYK progress");
          }
        } catch (error) {
          logger.error({ orderId, pageNumber, error }, `Failed to convert page ${pageNumber}`);
          throw error;
        }
      }

      // Update metadata
      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: "cmyk_converted",
          printMetadata: {
            ...metadata,
            cmykCovers,
            cmykInterior
          }
        }
      });

      logger.info(
        { orderId, cmykCoversCount: cmykCovers.length, cmykInteriorCount: cmykInterior.length },
        "CMYK conversion complete"
      );
      
      const totalDuration = Date.now() - startTime;
      const totalImageCount = cmykCovers.length + cmykInterior.length;
      recordJobMetrics("story.cmyk", "success", totalDuration);
      recordPrintCmykMetrics(totalImageCount, totalDuration);

      // Chain to book assembly
      await queues.storyAssembly.add("story.assembly", { orderId });
    } catch (error) {
      logger.error({ orderId, error }, "CMYK conversion failed");
      recordJobMetrics("story.cmyk", "failure", Date.now() - startTime);
      throw error;
    }
  },
  { connection: redisConnection }
);


import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { redisConnection } from "../lib/redis";
import { logger } from "@kcs/shared";
import { recordJobMetrics, recordPrintHandoffMetrics } from "../lib/metrics";
import { createHmac } from "node:crypto";
import { Readable } from "node:stream";

interface StoryHandoffJobData {
  orderId: string;
}

const uploadToGoogleDrive = async (
  buffer: Buffer,
  fileName: string,
  folderId: string
): Promise<{ success: boolean; driveFileId?: string; error?: string }> => {
  try {
    const { google } = await import("googleapis");

    if (!process.env.GOOGLE_DRIVE_CREDENTIALS_JSON) {
      throw new Error("GOOGLE_DRIVE_CREDENTIALS_JSON not set");
    }

    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    const drive = google.drive({ version: "v3", auth });

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        mimeType: "application/pdf",
        body: bufferToStream(buffer)
      }
    });

    const fileId = createResponse.data.id;

    if (!fileId) {
      throw new Error("Drive upload did not return file ID");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone"
      }
    });

    return {
      success: true,
      driveFileId: fileId
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

const sendPartnerWebhook = async (
  webhookUrl: string,
  payload: any,
  secret: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> => {
  try {
    const signature = createWebhookSignature(payload, secret);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-KCS-Signature": signature
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return {
        success: false,
        statusCode: response.status,
        error: `Webhook responded with status ${response.status}`
      };
    }

    return {
      success: true,
      statusCode: response.status
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
};

export const storyHandoffWorker = new Worker<StoryHandoffJobData>(
  "story.handoff",
  async (job) => {
    const startTime = Date.now();
    const { orderId } = job.data;

    try {
      logger.info({ orderId, jobId: job.id }, "Starting final handoff");

      const story = await prisma.story.findUnique({
        where: { orderId },
        include: {
          order: {
            include: {
              partner: true
            }
          }
        }
      });

      if (!story) {
        throw new Error(`Story not found for order ${orderId}`);
      }

      const partner = story.order.partner;
      const metadata = (story.printMetadata as any) || {};

      const coverSpreadUrl = metadata.coverSpread as string | null;
      const insideBookUrl = metadata.insideBookPdf as string | null;

      if (!coverSpreadUrl || !insideBookUrl) {
        throw new Error(`Missing print deliverables: coverSpread=${!!coverSpreadUrl}, insideBook=${!!insideBookUrl}`);
      }

      let uploadStatus = "completed";
      const driveFileIds: { coverSpread?: string; insideBook?: string } = {};

      // Upload to Google Drive if configured
      if (partner.driveFolderId) {
        logger.info({ orderId, folderId: partner.driveFolderId }, "Uploading to Google Drive");

        // Upload cover spread
        const coverSpreadUpload = await uploadToGoogleDrive(
          coverSpreadUrl,
          `${orderId}-cover-spread.pdf`,
          partner.driveFolderId
        );

        if (!coverSpreadUpload.success) {
          logger.error({ orderId, error: coverSpreadUpload.error }, "Cover spread upload failed");
          uploadStatus = "partial_upload";
        } else {
          driveFileIds.coverSpread = coverSpreadUpload.driveFileId;
          logger.info({ orderId, driveFileId: coverSpreadUpload.driveFileId }, "Cover spread uploaded to Drive");
        }

        // Upload inside book
        const insideBookUpload = await uploadToGoogleDrive(
          insideBookUrl,
          `${orderId}-inside-book.pdf`,
          partner.driveFolderId
        );

        if (!insideBookUpload.success) {
          logger.error({ orderId, error: insideBookUpload.error }, "Inside book upload failed");
          uploadStatus = "partial_upload";
        } else {
          driveFileIds.insideBook = insideBookUpload.driveFileId;
          logger.info({ orderId, driveFileId: insideBookUpload.driveFileId }, "Inside book uploaded to Drive");
        }

        // If both failed, mark as upload_failed
        if (!driveFileIds.coverSpread && !driveFileIds.insideBook) {
          uploadStatus = "upload_failed";
        }
      } else {
        logger.warn({ orderId, partnerId: partner.id }, "No Drive folder ID configured, skipping Drive upload");
      }

      // Send webhook to partner
      if (partner.webhookUrl && uploadStatus !== "upload_failed") {
        logger.info({ orderId, webhookUrl: partner.webhookUrl }, "Sending partner webhook");

        const webhookPayload = {
          orderId,
          orderNumber: story.order.partnerOrderRef || orderId,
          status: uploadStatus,
          coverSpreadUrl: coverSpreadUrl,
          insideBookUrl: insideBookUrl,
          driveFolderId: partner.driveFolderId || null,
          driveFileIds: driveFileIds,
          completedAt: new Date().toISOString()
        };

        const webhookResult = await sendPartnerWebhook(
          partner.webhookUrl,
          webhookPayload,
          partner.webhookSecret
        );

        if (!webhookResult.success) {
          logger.error({ orderId, error: webhookResult.error }, "Partner webhook delivery failed");
          // Don't fail the entire job, just log the error
        } else {
          logger.info({ orderId, statusCode: webhookResult.statusCode }, "Partner webhook delivered");
        }
      } else if (!partner.webhookUrl) {
        logger.warn({ orderId, partnerId: partner.id }, "No webhook URL configured for partner");
      }

      // Update final status
      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: uploadStatus
        }
      });

      const hasDriveUploads = Object.keys(driveFileIds).length > 0;
      const hasWebhook = !!partner.webhookUrl;

      logger.info(
        {
          orderId,
          finalStatus: uploadStatus,
          hasDriveUploads,
          webhookSent: hasWebhook
        },
        "Final handoff complete"
      );

      recordJobMetrics("story.handoff", "success", Date.now() - startTime);
      recordPrintHandoffMetrics(uploadStatus, hasDriveUploads, hasWebhook);
    } catch (error) {
      logger.error({ orderId, error }, "Final handoff failed");
      recordJobMetrics("story.handoff", "failure", Date.now() - startTime);

      // Mark as failed
      await prisma.story.update({
        where: { orderId },
        data: {
          printStatus: "upload_failed"
        }
      });

      throw error;
    }
  },
  { connection: redisConnection }
);


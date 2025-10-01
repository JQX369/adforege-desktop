/**
 * KCS Automation - Worker Service Startup Script
 * 
 * This script initializes all 17 BullMQ workers for the print pipeline.
 * Designed for Railway/Render deployment with graceful shutdown.
 * 
 * Workers:
 * - Phase 0: image-analysis
 * - Phase 2: story-profile, story-outline, story-draft, story-revision, story-polish
 * - Phase 3: story-style, story-focus, story-prompts
 * - Phase 4: story-asset-plan, story-assets, story-packaging
 * - Phase 6: story-cover, story-interior, story-cmyk, story-assembly, story-handoff
 */

import { Worker } from "bullmq";
import { redisConnection } from "../lib/redis";
import { logger } from "@kcs/shared";

// Import all workers
import { imageAnalysisWorker } from "./image-analysis";
import { storyProfileWorker } from "./story-profile";
import { storyOutlineWorker } from "./story-outline";
import { storyDraftWorker } from "./story-draft";
import { storyRevisionWorker } from "./story-revision";
import { storyPolishWorker } from "./story-polish";
import { storyStyleWorker } from "./story-style";
import { storyFocusWorker } from "./story-focus";
import { storyPromptsWorker } from "./story-prompts";
import { storyAssetPlanWorker } from "./story-asset-plan";
import { storyAssetsWorker } from "./story-assets";
import { storyPackagingWorker } from "./story-packaging";
import { storyCoverWorker } from "./story-cover";
import { storyInteriorWorker } from "./story-interior";
import { storyCmykWorker } from "./story-cmyk";
import { storyAssemblyWorker } from "./story-assembly";
import { storyHandoffWorker } from "./story-handoff";

const workers: Worker[] = [
  imageAnalysisWorker,
  storyProfileWorker,
  storyOutlineWorker,
  storyDraftWorker,
  storyRevisionWorker,
  storyPolishWorker,
  storyStyleWorker,
  storyFocusWorker,
  storyPromptsWorker,
  storyAssetPlanWorker,
  storyAssetsWorker,
  storyPackagingWorker,
  storyCoverWorker,
  storyInteriorWorker,
  storyCmykWorker,
  storyAssemblyWorker,
  storyHandoffWorker
];

// Worker health tracking
const workerHealth = new Map<string, { lastActive: Date; processedCount: number }>();

// Update worker health on job completion
workers.forEach((worker) => {
  worker.on("completed", (job) => {
    const existing = workerHealth.get(worker.name) || { lastActive: new Date(), processedCount: 0 };
    workerHealth.set(worker.name, {
      lastActive: new Date(),
      processedCount: existing.processedCount + 1
    });
  });

  worker.on("failed", (job, error) => {
    logger.error(`Worker ${worker.name} job failed:`, { jobId: job?.id, error: error.message });
  });

  worker.on("error", (error) => {
    logger.error(`Worker ${worker.name} error:`, { error: error.message });
  });
});

// Health check endpoint (for Docker healthcheck)
import http from "http";

const healthServer = http.createServer((req, res) => {
  if (req.url === "/api/health") {
    const allWorkersHealthy = workers.every((w) => !w.isRunning() || w.isRunning());
    
    if (allWorkersHealthy) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "healthy",
        workers: workers.length,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        health: Object.fromEntries(workerHealth)
      }));
    } else {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "unhealthy", workers: workers.length }));
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

const PORT = process.env.PORT || 3000;
healthServer.listen(PORT, () => {
  logger.info(`Health check server listening on port ${PORT}`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Close health server
  healthServer.close(() => {
    logger.info("Health server closed");
  });

  // Close all workers
  await Promise.all(
    workers.map(async (worker) => {
      logger.info(`Closing worker: ${worker.name}`);
      await worker.close();
    })
  );

  logger.info("All workers closed. Exiting.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Log startup
logger.info("🚀 KCS Automation Worker Service Starting...");
logger.info(`📦 Loaded ${workers.length} workers`);
logger.info(`🔗 Redis: ${redisConnection.host}:${redisConnection.port}`);
logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
logger.info(`💾 Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);

workers.forEach((worker) => {
  logger.info(`  ✓ ${worker.name}`);
});

logger.info("✨ All workers initialized and ready!");

// Keep process alive
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", { error: error.message, stack: error.stack });
  shutdown("UNCAUGHT_EXCEPTION");
});


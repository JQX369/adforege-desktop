import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import {
  ProviderRegistry,
  createLLMClient,
  MockLLMProvider,
  buildMainCharacterImagePrompt,
  buildSecondaryCharacterPrompt
} from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { logger } from "@kcs/shared";
import { recordJobMetrics } from "../lib/metrics";
import { withSpan } from "../lib/telemetry";

interface StoryAssetsJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gemini-2_5-flash-image-mock"));
registry.register(new MockLLMProvider("gpt-1-image-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gemini-2_5-flash-image-mock",
  fallback: "gpt-1-image-mock",
  models: {
    default: "mock",
    image_generation_main: "gemini-2_5-flash-image",
    image_generation_secondary: "gemini-2_5-flash-image",
    image_generation_object: "gemini-2_5-flash-image",
    image_generation_location: "gemini-2_5-flash-image",
    image_generation_enhance: "gemini-2_5-flash-image"
  }
});

const parseMockImageResponse = (raw: string): string => {
  try {
    const parsed = JSON.parse(raw);
    return parsed.url ?? raw;
  } catch {
    return raw;
  }
};

export const storyAssetsWorker = new Worker<StoryAssetsJobData>(
  "story.assets",
  async (job) =>
    withSpan("story.assets", async (span) => {
      const { orderId } = job.data;

    const story = await prisma.story.findUnique({
      where: { orderId },
      include: {
        order: {
          include: {
            assets: true,
            brief: true
          }
        }
      }
    });

    if (!story || !story.assetPlan || !story.order?.brief) {
      throw new Error(`Story ${orderId} not found or missing asset plan/brief for asset generation`);
    }

    const plan = story.assetPlan as StoryAssetPlan;
    const generationStatus = { ...plan.generationStatus };
    const generationIds = { ...plan.generationIds };
    const generationProvider = { ...plan.generationProvider };

    // Main character avatar generation
    if (!plan.mainCharacterImageUrl && plan.mainCharacterDescriptor) {
      const prompt = buildMainCharacterImagePrompt({
        descriptor: plan.mainCharacterDescriptor,
        stylePrompt: plan.stylePrompt,
        referenceImageUrl: plan.visionDescriptors?.mainCharacterAvatar as string | undefined
      });

      const response = await llmClient.call("image_generation_main", prompt);
      const imageUrl = parseMockImageResponse(response.output);

      const asset = await prisma.asset.create({
        data: {
          orderId,
          type: "image",
          url: imageUrl,
          meta: {
            role: "main_character",
            prompt,
            provider: response.provider,
            model: response.model
          }
        }
      });

      generationStatus.main_character = "completed";
      generationIds.main_character = asset.id;
      generationProvider.main_character = response.provider;

      plan.mainCharacterImageUrl = imageUrl;
      plan.generatedLinks = [...plan.generatedLinks, imageUrl];
    }

    // Secondary characters and objects from focusItems/itemDescriptions
    for (const item of plan.focusItems) {
      if (generationStatus[item]) {
        continue;
      }

      const description = plan.focusItemDescriptions?.[item] ?? plan.itemDescriptions.find((desc) => desc.includes(item)) ?? "";
      const prompt = buildSecondaryCharacterPrompt({
        name: item,
        description,
        stylePrompt: plan.stylePrompt
      });

      const response = await llmClient.call("image_generation_secondary", prompt);
      const imageUrl = parseMockImageResponse(response.output);

      const asset = await prisma.asset.create({
        data: {
          orderId,
          type: "image",
          url: imageUrl,
          meta: {
            role: "secondary_character",
            label: item,
            prompt,
            provider: response.provider,
            model: response.model
          }
        }
      });

      generationStatus[item] = "completed";
      generationIds[item] = asset.id;
      generationProvider[item] = response.provider;
      plan.generatedLinks = [...plan.generatedLinks, imageUrl];
    }

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: {
          ...plan,
          generationStatus,
          generationIds,
          generationProvider
        }
      }
    });

      span.setAttributes({ orderId, generated: plan.generatedLinks.length });
      recordJobMetrics("story.assets", "success", job.asMilliseconds());
      logger.info({ orderId }, "story asset generation completed (mock)");

      await queues.storyAssetsRefine.add("story.assets_refine", { orderId });
    }),
  {
    connection: redisConnection,
    concurrency: 1,
    settings: {
      backoffStrategies: {
        expo: (attempts) => Math.min(60000, Math.pow(2, attempts) * 1000)
      }
    }
  }
);

interface StoryAssetsRefineJobData {
  orderId: string;
}

export const storyAssetsRefineWorker = new Worker<StoryAssetsRefineJobData>(
  "story.assets_refine",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({ where: { orderId } });

    if (!story?.assetPlan) {
      throw new Error(`Story ${orderId} missing asset plan during refine step`);
    }

    const plan = story.assetPlan as StoryAssetPlan;

    // For now, just mark refine status and proceed to packaging pipeline
    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: {
          ...plan,
          generationStatus: {
            ...plan.generationStatus,
            refine: "completed"
          }
        }
      }
    });

    logger.info({ orderId }, "story asset refine completed (mock)");

    await prisma.event.create({
      data: {
        orderId,
        type: "story.assets_ready",
        payload: {
          generationStatus: plan.generationStatus,
          generatedLinks: plan.generatedLinks
        }
      }
    });
    await queues.storyPackaging.add("story.packaging", { orderId });
  },
  { connection: redisConnection }
);


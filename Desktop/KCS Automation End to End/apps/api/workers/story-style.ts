import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { logger } from "@kcs/shared";

interface StoryStyleJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-mock"));
registry.register(new MockLLMProvider("gpt5-high-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gpt5-high-mock",
  fallback: "gpt5-mock",
  models: {
    default: "mock",
    style_main_character: "mock"
  }
});

const mockGenerateImage = async () => {
  return "https://assets.example.com/mock-main-character.png";
};

export const storyStyleWorker = new Worker<StoryStyleJobData>(
  "story.style",
  async (job) => {
    const { orderId } = job.data;

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

    if (!story?.order?.brief) {
      throw new Error(`Story ${orderId} missing order brief for style analysis`);
    }

    const assetPlan = (story.assetPlan as StoryAssetPlan | null) ?? null;
    if (!assetPlan) {
      throw new Error(`Story ${orderId} missing assetPlan for style analysis`);
    }

    const stylePrompt = assetPlan.stylePrompt;
    const childName = story.order.brief.raw?.brief?.child?.first_name ?? "Child";
    const gender = story.order.brief.raw?.brief?.child?.gender ?? "unspecified";

    const descriptorPrompt = `You are designing a children's book avatar. Using this style specification and child info, describe the main character's consistent visual traits in 40 words.

Style:
${stylePrompt}

Child name: ${childName}
Gender: ${gender}`;

    const descriptorResponse = await llmClient.call("style_main_character", descriptorPrompt);

    const imageUrl = await mockGenerateImage();

    const updatedPlan: StoryAssetPlan = {
      ...assetPlan,
      mainCharacterDescriptor: descriptorResponse.output,
      mainCharacterPrompt: descriptorResponse.output,
      mainCharacterImageUrl: imageUrl
    };

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: updatedPlan
      }
    });

    logger.info({ orderId }, "story style avatar prepared");

    await queues.storyFocus.add("story.focus", { orderId });
  },
  { connection: redisConnection }
);


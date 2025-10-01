import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import { logger } from "@kcs/shared";

interface StoryPolishJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gpt5-mock",
  models: {
    default: "mock",
    story_polish: "mock"
  }
});

export const storyPolishWorker = new Worker<StoryPolishJobData>(
  "story.polish",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({ where: { orderId } });

    if (!story?.draftText) {
      throw new Error(`Story ${orderId} missing text for polish`);
    }

    const prompt = `Please lightly proof and polish the children's story below.
- Do not change plot, structure, or character names.
- Improve grammar, punctuation, and sentence flow only as needed.
- Keep vocabulary appropriate for the reading stage.

Story:\n${story.draftText}`;

    const response = await llmClient.call("story_polish", prompt);

    await prisma.story.update({
      where: { orderId },
      data: {
        status: "story_finalized",
        finalText: response.output,
        updatedAt: new Date()
      }
    });

    await prisma.storyVersion.create({
      data: {
        storyId: story.id,
        version: story.version + 1,
        stage: "polished",
        content: response.output
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.finalized",
        payload: { preview: response.output.slice(0, 200) }
      }
    });

    logger.info({ orderId }, "story polished and finalized");
  },
  { connection: redisConnection }
);


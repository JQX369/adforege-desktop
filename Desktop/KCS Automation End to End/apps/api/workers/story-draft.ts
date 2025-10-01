import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import { logger } from "@kcs/shared";
import { getReadingStageProfile } from "../lib/story";

interface StoryDraftJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-high-mock"));
registry.register(new MockLLMProvider("gpt5-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gpt5-high-mock",
  fallback: "gpt5-mock",
  models: {
    default: "mock",
    story_draft: "mock"
  }
});

export const storyDraftWorker = new Worker<StoryDraftJobData>(
  "story.draft",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({
      where: { orderId },
      include: { order: { include: { brief: true } } }
    });

    if (!story || !story.outlineText) {
      throw new Error(`Story for order ${orderId} missing outline`);
    }

    const levelLabel = story.order?.brief?.raw?.brief?.reading_level ?? story.order?.brief?.raw?.readingLevel;
    const stageProfile = getReadingStageProfile(levelLabel);
    const maxWords = stageProfile.maxWords;

    const prompt = `Please write the full story using the structured outline and child-specific inputs below.

Constraints:
- Keep each page under ${maxWords} words.
- Use gentle vocabulary appropriate for age ${stageProfile.targetAge}.
- Maintain the tone: ${stageProfile.toneNote}.
- Respect sentence guidance: ${stageProfile.sentenceGuidance}.
- Include all required characters and locations.
- Format each page without "===" headers; use clear paragraphs or line breaks for each page summary.

Outline:
${story.outlineText}

Begin writing the story now.`;

    const response = await llmClient.call("story_draft", prompt);

    await prisma.story.update({
      where: { orderId },
      data: {
        status: "story_draft_ready",
        draftText: response.output,
        updatedAt: new Date()
      }
    });

    await prisma.storyVersion.create({
      data: {
        storyId: story.id,
        version: story.version,
        stage: "draft_v1",
        content: response.output
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.draft_ready",
        payload: { preview: response.output.slice(0, 200) }
      }
    });

    logger.info({ orderId }, "story draft generated");

    await queues.storyRevision.add("story.revise", { orderId });
  },
  { connection: redisConnection }
);


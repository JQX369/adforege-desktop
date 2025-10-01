import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import { logger } from "@kcs/shared";

interface StoryRevisionJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-mock"));
registry.register(new MockLLMProvider("gpt5-high-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gpt5-mock",
  fallback: "gpt5-high-mock",
  models: {
    default: "mock",
    story_critique: "mock",
    story_revision: "mock"
  }
});

export const storyRevisionWorker = new Worker<StoryRevisionJobData>(
  "story.revise",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({ where: { orderId } });

    if (!story?.draftText) {
      throw new Error(`Story ${orderId} has no draft to revise`);
    }

    const critiquePrompt = `Please critique the following children's story based on:
1. Strengths (structure, tone, emotion)
2. Issues (vocabulary fit, pacing, missing requirements)
3. Suggestions for improvement (focus on the audience age)
4. Confirm characters/locations/moral are included
5. One-sentence overall summary

Story:\n${story.draftText}`;

    const critique = await llmClient.call("story_critique", critiquePrompt);

    const revisionPrompt = `Revise the story below based on the editor's critique.
- Preserve structure and character names.
- Keep each page under the same word limit.
- Apply the suggestions faithfully.

Critique:\n${critique.output}

Original Story:\n${story.draftText}`;

    const revised = await llmClient.call("story_revision", revisionPrompt);

    await prisma.story.update({
      where: { orderId },
      data: {
        status: "story_revised",
        draftText: revised.output,
        validatorReport: { critique: critique.output },
        version: story.version + 1,
        updatedAt: new Date()
      }
    });

    await prisma.storyVersion.create({
      data: {
        storyId: story.id,
        version: story.version + 1,
        stage: "revised",
        content: revised.output,
        metadata: { critique: critique.output }
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.revised",
        payload: { summary: critique.output.slice(0, 200) }
      }
    });

    logger.info({ orderId }, "story revised");

    await queues.storyPrompts.add("story.prompts", { orderId });
  },
  { connection: redisConnection }
);


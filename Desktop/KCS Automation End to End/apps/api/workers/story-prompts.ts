import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { redisConnection } from "../lib/redis";
import { queues } from "../lib/queues";
import {
  ProviderRegistry,
  createLLMClient,
  MockLLMProvider,
  buildParagraphImagePrompt
} from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { logger } from "@kcs/shared";

interface StoryPromptJobData {
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
    story_paragraph_prompt: "mock",
    story_prompt_enhance: "mock"
  }
});

export const storyPromptWorker = new Worker<StoryPromptJobData>(
  "story.prompts",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({ where: { orderId } });

    if (!story?.assetPlan) {
      throw new Error(`Story ${orderId} missing asset plan for prompt generation`);
    }

    const plan = story.assetPlan as StoryAssetPlan;

    if (!plan.focusList.length) {
      throw new Error(`Story ${orderId} missing focus list before prompt generation`);
    }

    const basePrompts = plan.paragraphs.map((paragraph) => {
      const focusLine = plan.focusList[paragraph.index - 1] ?? "";
      return buildParagraphImagePrompt({
        paragraphNumber: paragraph.index,
        paragraphText: paragraph.text,
        focusLine,
        characterDescriptions: plan.focusItemDescriptions ?? {},
        stylePrompt: plan.stylePrompt,
        language: story.order?.brief?.raw?.brief?.language
      });
    });

    const baseOutputs: string[] = [];

    for (const prompt of basePrompts) {
      const response = await llmClient.call("story_paragraph_prompt", prompt);
      baseOutputs.push(response.output.trim());
    }

    const enhancedOutputs: string[] = [];
    for (const output of baseOutputs) {
      const enhanceResponse = await llmClient.call(
        "story_prompt_enhance",
        `Refine this image prompt while keeping format single-line and constraints intact:

${output}`
      );
      enhancedOutputs.push(enhanceResponse.output.trim());
    }

    const updatedPlan: StoryAssetPlan = {
      ...plan,
      imagePromptList: baseOutputs,
      imagePromptListEnhanced: enhancedOutputs
    };

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: updatedPlan
      }
    });

    logger.info({ orderId }, "story prompts generated");

    await queues.storyAssets.add("story.assets", { orderId });
  },
  { connection: redisConnection }
);


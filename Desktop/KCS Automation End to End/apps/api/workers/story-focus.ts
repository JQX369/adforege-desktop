import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { redisConnection } from "../lib/redis";
import { queues } from "../lib/queues";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { logger } from "@kcs/shared";

interface StoryFocusJobData {
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
    story_focus_list: "mock",
    focus_variables: "mock"
  }
});

export const storyFocusWorker = new Worker<StoryFocusJobData>(
  "story.focus",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({
      where: { orderId }
    });

    if (!story?.assetPlan) {
      throw new Error(`Story ${orderId} missing asset plan before focus extraction`);
    }

    const assetPlan = story.assetPlan as StoryAssetPlan;

    const focusPrompt = `Generate a numbered focus list for each paragraph. Each line should contain up to three items (characters, objects, locations) that reoccur.

Paragraphs:
${assetPlan.paragraphs.map((p) => `${p.index}. ${p.text}`).join("\n")}`;

    const focusResponse = await llmClient.call("story_focus_list", focusPrompt);
    const focusLines = focusResponse.output.split(/\n+/).map((line) => line.trim());

    const itemsPrompt = `Extract distinct variables from the focus list in order of first appearance. Return JSON array only.

List:
${focusLines.join("\n")}`;

    const itemsResponse = await llmClient.call("focus_variables", itemsPrompt);

    let focusItems: string[] = [];
    try {
      focusItems = JSON.parse(itemsResponse.output);
    } catch {
      logger.warn({ orderId, output: itemsResponse.output }, "focus variable parsing failed");
    }

    const updatedPlan: StoryAssetPlan = {
      ...assetPlan,
      focusList: focusLines,
      focusItems,
      cleanedFocusList: focusLines
    };

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: updatedPlan
      }
    });

    logger.info({ orderId }, "story focus list generated");

    await queues.storyProfile.add("story.profile", { orderId });
  },
  { connection: redisConnection }
);


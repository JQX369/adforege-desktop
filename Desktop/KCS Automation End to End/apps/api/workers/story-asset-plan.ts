import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider, DEFAULT_STYLE_TEXT, DEFAULT_NEGATIVE_PROMPT, DEFAULT_STYLE_TOKEN, buildStylePrompt } from "@kcs/llm";
import { getReadingStageProfile } from "../lib/story";
import type { StoryAssetPlan } from "@kcs/types";

interface AssetPlanJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-mock"));
registry.register(new MockLLMProvider("gpt5-high-mock"));

createLLMClient(registry, {
  primary: "gpt5-mock",
  fallback: "gpt5-high-mock",
  models: {
    default: "mock",
    story_paragraphs: "mock"
  }
});

export const storyAssetPlanWorker = new Worker<AssetPlanJobData>(
  "story.asset_plan",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({
      where: { orderId },
      include: { order: { include: { brief: true } } }
    });

    if (!story?.finalText) {
      throw new Error(`Story ${orderId} not finalized`);
    }

    const paragraphs = story.finalText
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ index: index + 1, text }));

    const levelLabel = story.order?.brief?.raw?.brief?.reading_level ?? story.order?.brief?.raw?.readingLevel;
    const profile = getReadingStageProfile(levelLabel);

    const stylePrompt = buildStylePrompt({
      stageLabel: profile.stage,
      styleText: DEFAULT_STYLE_TEXT,
      negativePrompt: DEFAULT_NEGATIVE_PROMPT,
      styleToken: DEFAULT_STYLE_TOKEN
    });

    const assetPlan: StoryAssetPlan = {
      paragraphCount: paragraphs.length,
      paragraphs,
      stylePrompt,
      mainCharacterDescriptor: undefined,
      mainCharacterPrompt: undefined,
      mainCharacterImageUrl: undefined,
      focusList: [],
      focusItems: [],
      cleanedFocusList: [],
      mainCharacterPrompts: [],
      enhancedPrompts: [],
      itemDescriptions: [],
      generatedLinks: [],
      overlayChoice: undefined,
      titleOptions: [],
      blurb: undefined,
      visionDescriptors: {
        style: stylePrompt
      }
    };

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan,
        assetPlanVersion: story.assetPlanVersion + 1,
        status: "assets_in_progress"
      }
    });

    await queues.storyStyle.add("story.style", { orderId });
  },
  { connection: redisConnection }
);


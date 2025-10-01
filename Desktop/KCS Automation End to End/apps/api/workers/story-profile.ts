import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider, buildStoryProfilePrompt } from "@kcs/llm";
import { EmotionalProfileSchema, StoryAssetPlan } from "@kcs/types";
import { getReadingStageProfile } from "../lib/story";
import { logger } from "@kcs/shared";

interface StoryProfileJobData {
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
    story_profile: "mock"
  }
});

export const storyProfileWorker = new Worker<StoryProfileJobData>(
  "story.profile",
  async (job) => {
    const { orderId } = job.data;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        brief: true,
        assets: true,
        stories: true
      }
    });

    if (!order || !order.brief) {
      throw new Error(`Order ${orderId} not found or missing brief`);
    }

    const levelLabel = order.brief.raw?.brief?.reading_level ?? order.brief.raw?.readingLevel;
    const readingProfile = getReadingStageProfile(levelLabel);
    const descriptors = order.brief.imageDescriptors ?? [];
    const assetPlan = story.assetPlan as StoryAssetPlan | null;

    const prompt = buildStoryProfilePrompt({
      childName: order.brief.raw?.brief?.child?.first_name ?? "Child",
      age: order.brief.raw?.brief?.child?.age ?? 5,
      gender: order.brief.raw?.brief?.child?.gender ?? "unspecified",
      descriptors,
      readingProfile: {
        storyConcept: order.brief.raw?.brief?.interests ?? "",
        storyArc: order.brief.raw?.brief?.objective ?? "",
        storyMoral: order.brief.raw?.brief?.moral ?? "",
        storyTone: order.brief.raw?.brief?.tone ?? "",
        characters: JSON.stringify(order.brief.raw?.characters ?? []),
        locations: JSON.stringify(order.brief.raw?.locations ?? []),
        sensitiveTopics: JSON.stringify(order.brief.raw?.sensitive_topics ?? []),
        maxWords: readingProfile.maxWords
      }
    });

    const response = await llmClient.call("story_profile", prompt);

    const profile = EmotionalProfileSchema.safeParse({
      core_emotions: [response.output],
      tone_guidance: response.output,
      inclusivity_notes: [],
      conflict_guidance: undefined
    });

    await prisma.story.update({
      where: { orderId },
      data: {
        status: "profile_ready",
        emotionalProfile: profile.success ? profile.data : response.output,
        storyBrief: order.brief.raw?.story_brief ?? null,
        assetPlan: {
          ...(assetPlan ?? {}),
          mainCharacterDescriptor:
            assetPlan?.mainCharacterDescriptor ?? (profile.success ? profile.data.tone_guidance : response.output)
        }
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.profile_ready",
        payload: { summary: response.output.slice(0, 200) }
      }
    });

    logger.info({ orderId }, "story profile generated");

    await queues.storyOutline.add("story.outline", { orderId });
  },
  { connection: redisConnection }
);


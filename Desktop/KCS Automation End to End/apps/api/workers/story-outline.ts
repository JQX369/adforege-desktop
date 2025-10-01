import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { queues } from "../lib/queues";
import { redisConnection } from "../lib/redis";
import { ProviderRegistry, createLLMClient, MockLLMProvider, buildStoryOutlinePrompt } from "@kcs/llm";
import { StoryBriefSchema } from "@kcs/types";
import { logger } from "@kcs/shared";

interface StoryOutlineJobData {
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
    story_outline: "mock"
  }
});

export const storyOutlineWorker = new Worker<StoryOutlineJobData>(
  "story.outline",
  async (job) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({
      where: { orderId },
      include: { order: { include: { brief: true } } }
    });

    if (!story || !story.order?.brief) {
      throw new Error(`Story for order ${orderId} not ready for outline`);
    }

    const readingProfile = story.order.brief.raw?.readingProfile ?? {};
    const briefParsed = StoryBriefSchema.safeParse(story.storyBrief ?? {});

    const prompt = buildStoryOutlinePrompt({
      childName: story.order.brief.raw?.brief?.child?.first_name ?? "Child",
      age: story.order.brief.raw?.brief?.child?.age ?? 5,
      gender: story.order.brief.raw?.brief?.child?.gender ?? "unspecified",
      readingProfile: {
        maxWords: readingProfile.maxWords ?? 25,
        targetAge: readingProfile.targetAge ?? 4,
        referenceBooks: readingProfile.referenceBooks ?? "",
        toneNote: readingProfile.toneNote ?? "",
        sentenceGuidance: readingProfile.sentenceGuidance ?? "",
        stage: readingProfile.stage ?? ""
      },
      storyBrief: briefParsed.success
        ? briefParsed.data
        : {
            primary_theme: story.order.brief.raw?.brief?.interests ?? "",
            supporting_themes: [],
            settings: [],
            avoid_topics: []
          },
      emotionalProfileSummary: typeof story.emotionalProfile === "string" ? story.emotionalProfile : JSON.stringify(story.emotionalProfile ?? {}),
      characters: ((story.order.brief.raw?.characters ?? []) as Array<{ name: string; relationship?: string }>).map(
        (character) => ({ name: character.name, relationship: character.relationship })
      ),
      locations: ((story.order.brief.raw?.locations ?? []) as Array<{ description?: string }>).map(
        (location) => location.description ?? ""
      ),
      moral: story.order.brief.raw?.brief?.moral ?? "",
      quest: story.order.brief.raw?.brief?.objective ?? ""
    });

    const response = await llmClient.call("story_outline", prompt);

    await prisma.story.update({
      where: { orderId },
      data: {
        status: "outline_ready",
        outlineText: response.output,
        updatedAt: new Date()
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.outline_ready",
        payload: { summary: response.output.slice(0, 200) }
      }
    });

    logger.info({ orderId }, "story outline generated");

    await queues.storyDraft.add("story.draft", { orderId });
  },
  { connection: redisConnection }
);


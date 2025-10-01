import { Worker } from "bullmq";
import { prisma } from "@kcs/db";
import { redisConnection } from "../lib/redis";
import { queues } from "../lib/queues";
import { ProviderRegistry, createLLMClient, MockLLMProvider } from "@kcs/llm";
import type { StoryAssetPlan } from "@kcs/types";
import { logger } from "@kcs/shared";
import { recordJobMetrics } from "../lib/metrics";
import { withSpan } from "../lib/telemetry";

interface StoryPackagingJobData {
  orderId: string;
}

const registry = new ProviderRegistry();
registry.register(new MockLLMProvider("gpt5-packaging-mock"));

const llmClient = createLLMClient(registry, {
  primary: "gpt5-packaging-mock",
  models: {
    default: "mock",
    packaging_overlay: "mock",
    packaging_titles: "mock",
    packaging_blurb: "mock"
  }
});

const CHOICE_RULES = [
  { label: "3-4", min: 0, max: 199 },
  { label: "4-6", min: 200, max: 269 },
  { label: "6-7", min: 270, max: 399 },
  { label: "8", min: 400, max: Number.MAX_SAFE_INTEGER }
];

export const storyPackagingWorker = new Worker<StoryPackagingJobData>(
  "story.packaging",
  async (job) =>
    withSpan("story.packaging", async (span) => {
    const { orderId } = job.data;

    const story = await prisma.story.findUnique({ where: { orderId } });

    if (!story?.assetPlan || !story.finalText) {
      throw new Error(`Story ${orderId} missing asset plan or final text for packaging`);
    }

    const plan = story.assetPlan as StoryAssetPlan;

    const paragraphLengths = plan.paragraphs.map((p) => p.text.length);
    const totalCharacters = paragraphLengths.reduce((sum, value) => sum + value, 0);

    const overlayChoice =
      CHOICE_RULES.find((choice) => totalCharacters >= choice.min && totalCharacters <= choice.max)?.label ?? "4-6";

    const titlesResponse = await llmClient.call(
      "packaging_titles",
      `Generate 3 playful, vivid title ideas (<=4 words) for this story.
Story:
${story.finalText}`
    );

    const blurbResponse = await llmClient.call(
      "packaging_blurb",
      `Write an intriguing blurb under 55 words summarizing the story without spoilers.
Story:
${story.finalText}`
    );

    const mainCharacterLink = plan.generatedLinks.find((link) => link.includes("main-character"));
    const secondaryLinks = plan.generatedLinks.filter((link) => link.includes("secondary"));
    const objectLinks = plan.generatedLinks.filter((link) => link.includes("object"));
    const locationLinks = plan.generatedLinks.filter((link) => link.includes("location"));

    const orderedLinks = [mainCharacterLink, ...secondaryLinks, ...objectLinks, ...locationLinks].filter(Boolean) as string[];

    const updatedPlan: StoryAssetPlan = {
      ...plan,
      packagedLinks: {
        ordered: orderedLinks,
        mainCharacter: mainCharacterLink,
        secondaryCharacters: secondaryLinks,
        objects: objectLinks,
        locations: locationLinks,
        overlayChoice,
        titleOptions: titlesResponse.output.split("\n").filter(Boolean),
        blurb: blurbResponse.output.trim()
      },
      overlayChoice,
      titleOptions: titlesResponse.output.split("\n").filter(Boolean),
      blurb: blurbResponse.output.trim()
    };

    await prisma.story.update({
      where: { orderId },
      data: {
        assetPlan: updatedPlan,
        generationState: {
          packagedAt: new Date().toISOString(),
          overlayChoice
        }
      }
    });

    await prisma.event.create({
      data: {
        orderId,
        type: "story.packaged",
        payload: {
          overlayChoice,
          titleOptions: updatedPlan.titleOptions,
          blurb: updatedPlan.blurb,
          generatedLinks: orderedLinks
        }
      }
    });

    span.setAttributes({ orderId, titles: updatedPlan.titleOptions.length, overlayChoice });
    recordJobMetrics("story.packaging", "success", job.asMilliseconds());
    logger.info({ orderId }, "story packaging completed (mock)");

    await queues.storyPolish.add("story.polish", { orderId });
  }),
  { connection: redisConnection }
);


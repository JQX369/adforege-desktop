import { Queue, QueueScheduler } from "bullmq";
import { redisConnection } from "../redis";
import { createCounter } from "../metrics";

const queueConfig = { connection: redisConnection } as const;

export const queueNames = {
  imageAnalysis: "images.analyze_uploads",
  briefExtraction: "brief.extract",
  storyAssetPlan: "story.asset_plan",
  storyStyle: "story.style",
  storyFocus: "story.focus",
  storyPrompts: "story.prompts",
  storyAssets: "story.assets",
  storyAssetsRefine: "story.assets_refine",
  storyPackaging: "story.packaging",
  storyProfile: "story.profile",
  storyOutline: "story.outline",
  storyDraft: "story.draft",
  storyRevision: "story.revise",
  storyPolish: "story.polish",
  storyCover: "story.cover",
  storyInterior: "story.interior",
  storyCmyk: "story.cmyk",
  storyAssembly: "story.assembly",
  storyHandoff: "story.handoff"
} as const;

type QueueKeys = keyof typeof queueNames;

export const queues = Object.fromEntries(
  Object.entries(queueNames).map(([key, name]) => [key, new Queue(name, queueConfig)])
) as Record<QueueKeys, Queue>;

export const queueCounters = {
  storyAssets: createCounter("story_assets_processed_total", "Number of story assets jobs processed"),
  storyPackaging: createCounter("story_packaging_processed_total", "Number of story packaging jobs processed")
};

export const schedulers = Object.fromEntries(
  Object.entries(queueNames).map(([key, name]) => [key, new QueueScheduler(name, queueConfig)])
) as Record<QueueKeys, QueueScheduler>;


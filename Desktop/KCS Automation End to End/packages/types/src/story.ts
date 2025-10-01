import { z } from "zod";

export const StoryStatusSchema = z.enum([
  "pending_emotional_profile",
  "profile_ready",
  "outline_in_progress",
  "outline_ready",
  "draft_in_progress",
  "story_draft_ready",
  "revision_in_progress",
  "story_revised",
  "polish_in_progress",
  "story_finalized",
  "story_requires_review"
]);

export type StoryStatus = z.infer<typeof StoryStatusSchema>;

export const StoryBriefSchema = z.object({
  primary_theme: z.string(),
  supporting_themes: z.array(z.string()).default([]),
  settings: z.array(z.string()).default([]),
  avoid_topics: z.array(z.string()).default([])
});

export type StoryBrief = z.infer<typeof StoryBriefSchema>;

export const EmotionalProfileSchema = z.object({
  core_emotions: z.array(z.string()).default([]),
  tone_guidance: z.string(),
  inclusivity_notes: z.array(z.string()).default([]),
  conflict_guidance: z.string().optional()
});

export type EmotionalProfile = z.infer<typeof EmotionalProfileSchema>;

export const StoryAssetPlanSchema = z.object({
  paragraphCount: z.number(),
  paragraphs: z.array(
    z.object({
      index: z.number(),
      text: z.string()
    })
  ),
  stylePrompt: z.string(),
  mainCharacterDescriptor: z.string().optional(),
  mainCharacterPrompt: z.string().optional(),
  mainCharacterImageUrl: z.string().optional(),
  focusList: z.array(z.string()).default([]),
  focusItems: z.array(z.string()).default([]),
  cleanedFocusList: z.array(z.string()).default([]),
  focusItemDescriptions: z.record(z.string(), z.string()).default({}),
  enhancedPrompts: z.array(z.string()).default([]),
  itemDescriptions: z.array(z.string()).default([]),
  imagePromptList: z.array(z.string()).default([]),
  imagePromptListEnhanced: z.array(z.string()).default([]),
  generatedLinks: z.array(z.string()).default([]),
  generationStatus: z.record(z.string(), z.string()).default({}),
  generationIds: z.record(z.string(), z.string()).default({}),
  generationProvider: z.record(z.string(), z.string()).default({}),
  packagedLinks: z.object({
    ordered: z.array(z.string()).default([]),
    mainCharacter: z.string().optional(),
    secondaryCharacters: z.array(z.string()).default([]),
    objects: z.array(z.string()).default([]),
    locations: z.array(z.string()).default([]),
    overlayChoice: z.string().optional(),
    titleOptions: z.array(z.string()).default([]),
    blurb: z.string().optional()
  }).default({ ordered: [], secondaryCharacters: [], objects: [], locations: [], titleOptions: [] }),
  overlayChoice: z.string().optional(),
  titleOptions: z.array(z.string()).default([]),
  blurb: z.string().optional(),
  visionDescriptors: z.record(z.string(), z.unknown()).default({})
});

export type StoryAssetPlan = z.infer<typeof StoryAssetPlanSchema>;


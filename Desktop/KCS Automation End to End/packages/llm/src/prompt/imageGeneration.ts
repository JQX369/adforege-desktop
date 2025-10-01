import type { StoryAssetPlan } from "@kcs/types";

interface BasePromptContext {
  stylePrompt: string;
  language?: string;
}

interface MainCharacterContext extends BasePromptContext {
  descriptor: string;
  referenceImageUrl?: string;
}

interface SecondaryCharacterContext extends BasePromptContext {
  name: string;
  description: string;
  referenceImageUrl?: string;
}

interface ObjectContext extends BasePromptContext {
  label: string;
  description: string;
}

interface LocationContext extends BasePromptContext {
  description: string;
  referenceImageUrl?: string;
}

export const buildMainCharacterImagePrompt = (ctx: MainCharacterContext) => {
  return `Create a vibrant children's book character portrait with a transparent background.

Character Descriptor:
${ctx.descriptor}

Style Requirements:
${ctx.stylePrompt}

${ctx.referenceImageUrl ? `Reference Image: ${ctx.referenceImageUrl}` : ""}

Rules:
- Neutral stance, friendly expression.
- Ensure anatomy, proportions, and outfit continuity.
- Use high-resolution (1024x1024) transparent PNG.
- Avoid distortion, artifacts, or background elements.`;
};

export const buildSecondaryCharacterPrompt = (ctx: SecondaryCharacterContext) => {
  return `Generate a full-body portrait for the recurring character "${ctx.name}" with a transparent background.

Description:
${ctx.description}

Style Requirements:
${ctx.stylePrompt}

${ctx.referenceImageUrl ? `Reference Image: ${ctx.referenceImageUrl}` : ""}

Rules:
- Maintain continuity with the main character style.
- Use neutral stance, friendly expression unless otherwise stated.
- Deliver as 1024x1024 transparent PNG.
- Avoid noisy details or extra props.`;
};

export const buildObjectPrompt = (ctx: ObjectContext) => {
  return `Create an isolated illustration of the object "${ctx.label}" with a transparent background.

Description:
${ctx.description}

Style Requirements:
${ctx.stylePrompt}

Rules:
- Keep proportions consistent with children's book style.
- Deliver as 1024x1024 transparent PNG.
- Avoid text overlays or background elements.
- Keep lighting and palette aligned with story tone.`;
};

export const buildLocationPrompt = (ctx: LocationContext) => {
  return `Generate a scenic illustration for the story location.

Description:
${ctx.description}

Style Requirements:
${ctx.stylePrompt}

${ctx.referenceImageUrl ? `Reference Image: ${ctx.referenceImageUrl}` : ""}

Rules:
- No characters present; focus on environment.
- Deliver as 16:9 PNG with clean edges (no transparency required).
- Ensure colors complement character palette.
- Avoid text, symbols, or logos.`;
};

export const buildImageBatchLabel = (plan: StoryAssetPlan, axis: "main" | "secondary" | "object" | "location") => {
  return `order:${plan.mainCharacterImageUrl ?? "unknown"}:batch:${axis}`;
};

export const buildParagraphImagePrompt = ({
  paragraphNumber,
  paragraphText,
  focusLine,
  characterDescriptions,
  stylePrompt,
  language
}: {
  paragraphNumber: number;
  paragraphText: string;
  focusLine: string;
  characterDescriptions: Record<string, string>;
  stylePrompt: string;
  language?: string;
}) => {
  const descriptors = Object.entries(characterDescriptions)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");

  return `Paragraph ${paragraphNumber}: ${paragraphText}
Focus line: ${focusLine}

Known descriptors:
${descriptors}

Style reference:
${stylePrompt}

Language: ${language ?? "match story language"}

Generate a single-line image prompt compliant with previous constraints.`;
};


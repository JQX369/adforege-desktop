export interface CoverPromptContext {
  title: string;
  blurb: string;
  mainCharacterName: string;
  mainCharacterDescription: string;
  stylePrompt: string;
  readingAge: string;
}

export interface InteriorPagePromptContext {
  pageNumber: number;
  paragraphText: string;
  charactersPresent: Array<{ name: string; description: string }>;
  setting: string;
  stylePrompt: string;
  readingAge: string;
}

export const buildCoverFrontPrompt = (ctx: CoverPromptContext) => {
  return `Create a vibrant children's book front cover illustration for a ${ctx.readingAge} reader.

Title: ${ctx.title}
Main Character: ${ctx.mainCharacterName}
Character Description: ${ctx.mainCharacterDescription}

Story Hook:
${ctx.blurb}

Style Requirements:
${ctx.stylePrompt}

Rules:
- Feature ${ctx.mainCharacterName} prominently in an engaging pose
- Convey the story's tone and excitement
- Use bright, age-appropriate colors
- Leave clear space for title text at top
- Deliver as 2433×2433px RGB PNG @ 300 DPI
- Ensure all elements fit within 6mm safety margins (avoid critical content at edges)`;
};

export const buildCoverBackPrompt = (ctx: CoverPromptContext) => {
  return `Create a complementary back cover illustration for a ${ctx.readingAge} children's book.

Story Summary:
${ctx.blurb}

Style Requirements:
${ctx.stylePrompt}

Rules:
- Subtle scene or pattern that complements the front cover
- Can include secondary characters or story elements
- Leave ample space for blurb text (center area)
- Use same color palette as front cover
- Deliver as 2433×2433px RGB PNG @ 300 DPI
- Ensure all elements fit within 6mm safety margins`;
};

export const buildInteriorPagePrompt = (ctx: InteriorPagePromptContext) => {
  const charactersList = ctx.charactersPresent.map((c) => `${c.name}: ${c.description}`).join("\n");

  return `Create a full-page illustration for page ${ctx.pageNumber} of a ${ctx.readingAge} children's book.

Scene Text:
${ctx.paragraphText}

Characters Present:
${charactersList}

Setting: ${ctx.setting}

Style Requirements:
${ctx.stylePrompt}

Rules:
- Illustrate the key moment from the scene text
- Maintain character consistency and proportions
- Use vibrant, age-appropriate colors
- Leave clear space for text overlay (top or bottom third, depending on composition)
- Deliver as 2433×2433px RGB PNG @ 300 DPI
- Apply ${Math.floor(Math.random() * 3) + 4}% content shrink with edge bleed for print safety
- Avoid clutter; keep focal point clear`;
};

export const buildVisionScorePrompt = (imageUrls: string[], criteria: string) => {
  return `You are a children's book illustration expert. Evaluate the following ${imageUrls.length} candidate images based on these criteria:

${criteria}

For each image, provide:
1. A score from 1-10
2. Brief strengths (1-2 sentences)
3. Any concerns (1-2 sentences)

Format your response as:
Image 1: [score]/10
Strengths: [text]
Concerns: [text]

Image 2: [score]/10
...

Recommend the best choice at the end.`;
};

export const buildOverlayPositionPrompt = (imageUrl: string, textLength: number) => {
  return `Analyze this children's book page illustration and recommend the optimal text overlay position.

Image: ${imageUrl}
Text Length: ${textLength} characters (approximately ${Math.ceil(textLength / 100)} lines)

Analyze:
1. Composition focal points (where is the main action/character?)
2. Negative space availability (top, bottom, left, right)
3. Color contrast zones (where would text be most readable?)

Recommend one of these overlay positions:
- "top" (upper third)
- "bottom" (lower third)
- "top_left" (upper left quadrant)
- "top_right" (upper right quadrant)
- "bottom_left" (lower left quadrant)
- "bottom_right" (lower right quadrant)
- "topMAX" (for text >450 chars, covers upper half)
- "bottomMAX" (for text >450 chars, covers lower half)

Provide your recommendation as a single word (e.g., "bottom" or "topMAX"), followed by a brief justification (1-2 sentences).`;
};


interface OutlinePromptInput {
  childName: string;
  age: number;
  gender: string;
  readingProfile: {
    maxWords: number;
    targetAge: number;
    referenceBooks: string;
    toneNote: string;
    sentenceGuidance: string;
    stage: string;
  };
  storyBrief: {
    primary_theme: string;
    supporting_themes: string[];
    settings: string[];
    avoid_topics: string[];
  };
  emotionalProfileSummary: string;
  characters: Array<{ name: string; relationship?: string }>;
  locations: string[];
  moral: string;
  quest: string;
}

export const buildStoryOutlinePrompt = (input: OutlinePromptInput) => {
  const { childName, age, gender, readingProfile, storyBrief, emotionalProfileSummary, characters, locations, moral, quest } = input;

  const characterList = characters
    .map((c, index) => `Character ${index + 1}: ${c.name}${c.relationship ? ` (${c.relationship})` : ""}`)
    .join("\n");

  const locationList = locations.length ? locations.join(", ") : "None specified";
  const avoidList = storyBrief.avoid_topics.length ? storyBrief.avoid_topics.join(", ") : "None";

  return `You are preparing a custom children's story outline.

Child: ${childName}, age ${age}, ${gender}.
Reading stage: ${readingProfile.stage} (target age ${readingProfile.targetAge}).
Tone guidance: ${readingProfile.toneNote}.
Sentence guidance: ${readingProfile.sentenceGuidance}.
Reference books: ${readingProfile.referenceBooks}.

Story brief:
- Primary theme: ${storyBrief.primary_theme}
- Supporting themes: ${storyBrief.supporting_themes.join(", ") || "None"}
- Settings: ${storyBrief.settings.join(", ") || "None"}
- Avoid topics: ${avoidList}
- Quest / Objective: ${quest}
- Moral / Lesson: ${moral}

Additional characters:
${characterList || "None"}

Locations to include: ${locationList}

Child emotional profile summary:
${emotionalProfileSummary}

Output format:
- Generate a page-by-page outline covering 3 acts (setup, challenge, resolution).
- Each page should be a 1-2 sentence summary, numbered "Page X:".
- Total pages should fit the reading stage (typically 20-25 pages; keep each summary aligned with max ${readingProfile.maxWords} words per eventual page).
- Make sure the outline reflects the themes, emotional beats, characters, and avoids restricted topics.
- Do NOT write the full story; outline only.

Begin outlining now.`;
};


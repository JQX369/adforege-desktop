export interface ReadingStageProfile {
  stage: string;
  maxWords: number;
  targetAge: number;
  vocab: string;
  referenceBooks: string;
  toneNote: string;
  sentenceGuidance: string;
}

const lookup: Record<string, ReadingStageProfile> = {
  "Nursery & Reception, Approx age 3-5": {
    stage: "Nursery-Rec",
    maxWords: 25,
    targetAge: 4,
    vocab: "CVC words, heavy picture cues",
    referenceBooks: "The Very Hungry Caterpillar, Goodnight Moon, Owl Babies",
    toneNote: "Use repetition, soft emotion, and safe curiosity. Keep the story quiet, rhythmic, and gentle.",
    sentenceGuidance: "Very short, one-clause sentences. Lots of repetition."
  },
  "Early KS1 Reader, Approx age 5-6": {
    stage: "Early-KS1",
    maxWords: 40,
    targetAge: 6,
    vocab: "simple sight words + digraphs",
    referenceBooks: "Zog, We're Going on a Bear Hunt, Stick Man",
    toneNote: "Let the story move quickly but simply. Add gentle challenges or fun cause-and-effect moments.",
    sentenceGuidance: "One idea per sentence. Some dialogue and light description okay."
  },
  "KS1 Confident, Approx age 6-7": {
    stage: "KS1-Conf",
    maxWords: 60,
    targetAge: 7,
    vocab: "two-clause sentences",
    referenceBooks: "Flat Stanley, Katie in London, The Tiger Who Came to Tea",
    toneNote: "Introduce simple journeys, emotional shifts, or small surprises. Keep a playful but clear narrative.",
    sentenceGuidance: "Compound sentences allowed. Dialogue and narration should be balanced."
  },
  "Lower KS2 Starter, Approx age 7-8": {
    stage: "LKS2-Start",
    maxWords: 100,
    targetAge: 8,
    vocab: "intro figurative language",
    referenceBooks: "The Twits, Magic Tree House, Dog Man",
    toneNote: "The main character should face a real challenge. Let imagination and humour mix with vivid action.",
    sentenceGuidance: "Vary sentence openers. Add character agency and lively language."
  },
  "Lower KS2 Confident, Approx age 8-9": {
    stage: "LKS2-Conf",
    maxWords: 120,
    targetAge: 9,
    vocab: "varied openers, dialogue tags",
    referenceBooks: "Charlotte’s Web, The Worst Witch, Amelia Fang",
    toneNote: "Let the story feel deeper, with stronger emotion, growth, or surprise. It should still end gently and safely.",
    sentenceGuidance: "Use layered sentence structures with clear grammar. Emotional beats and pacing matter."
  }
};

const fallback: ReadingStageProfile = {
  stage: "Nursery-Rec",
  maxWords: 25,
  targetAge: 4,
  vocab: "CVC words, heavy picture cues",
  referenceBooks: "The Very Hungry Caterpillar",
  toneNote: "Use repetition, soft emotion, and safe curiosity.",
  sentenceGuidance: "Very short, one-clause sentences."
};

export const getReadingStageProfile = (label: string | undefined | null): ReadingStageProfile => {
  if (!label) {
    return fallback;
  }
  return lookup[label] ?? fallback;
};


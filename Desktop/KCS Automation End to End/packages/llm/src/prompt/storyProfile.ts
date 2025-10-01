interface StoryProfilePromptInput {
  childName: string;
  age: number;
  gender: string;
  descriptors: unknown;
  readingProfile: {
    storyConcept: string;
    storyArc: string;
    storyMoral: string;
    storyTone: string;
    characters: string;
    locations: string;
    sensitiveTopics: string;
    maxWords: number;
  };
}

export const buildStoryProfilePrompt = ({ childName, age, gender, descriptors, readingProfile }: StoryProfilePromptInput) => `Please analyze the following story parameters and generate a comprehensive emotional and thematic profile:

Child Information:
- Name: ${childName}
- Age: ${age}
- Gender: ${gender}

Story Elements:
- Interests or Story Concept: ${readingProfile.storyConcept}
- Story Objective or Quest: ${readingProfile.storyArc}
- Moral or Life Lesson: ${readingProfile.storyMoral}
- Tone or Style: ${readingProfile.storyTone}

Additional Characters:
${readingProfile.characters}

Locations to Include:
${readingProfile.locations}

Sensitive Topics to Avoid:
${readingProfile.sensitiveTopics}

Output Requirements:
- List of core emotions to evoke throughout the story
- Key themes and motifs to explore
- Narrative tone and style recommendations
- Considerations for inclusivity and cultural sensitivity
- Potential challenges or conflicts suitable for the child's age and interests
- Max ${readingProfile.maxWords} words per page`;

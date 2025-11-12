export interface GiftFormData {
  relationship: string
  ageRange: string
  gender: string
  occasion: string
  budget: string
  interests: string[]
  personality: string
  giftType: string
  avoid?: string[]
  living?: string
  location?: string
  requirements?: string
  context?: string
}

export function buildGiftPrompt(formData: GiftFormData): string {
  return `You are an expert gift advisor. Based on the following information about the gift recipient, suggest 3 perfect gift ideas that would delight them. Focus on thoughtful, creative suggestions that match their personality and interests.

RECIPIENT INFORMATION:
- Relationship: ${formData.relationship}
- Age Range: ${formData.ageRange}
- Gender: ${formData.gender}
- Occasion: ${formData.occasion}
- Budget: ${formData.budget}
- Primary Interests: ${formData.interests.join(', ')}
- Personality Type: ${formData.personality}
- Living Situation: ${formData.living}
- Gift Preference: ${formData.giftType}
- Categories to Avoid: ${(formData.avoid || []).join(', ') || 'None'}
- Living Situation: ${formData.living || 'Unspecified'}
- Location (optional): ${formData.location || 'Not specified'}
- Additional Context: ${formData.context || 'None'}

Please provide 3 gift recommendations in the following JSON format:
{
  "recommendations": [
    {
      "title": "Gift Name",
      "description": "Detailed description of the gift and why it's perfect for this person",
      "priceRange": "Estimated price range",
      "category": ["relevant", "categories"],
      "reasoning": "Why this gift matches their profile"
    }
  ]
}

Make sure each recommendation:
1. Fits within the specified budget
2. Avoids any mentioned categories to avoid
3. Considers their living situation and practical constraints
4. Aligns with their personality and interests
5. Is appropriate for the occasion
6. Takes into account local/nearby options or relevant events if a location was provided

Be creative and specific with your suggestions, avoiding generic gifts unless specifically requested.`
}

export function buildSearchQuery(recommendation: any): string {
  return `${recommendation.title} ${recommendation.category.join(' ')} gift`
}

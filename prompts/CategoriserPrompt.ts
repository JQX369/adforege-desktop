export interface ProductData {
  title: string
  description: string
  price: number
  images: string[]
  originalUrl: string
  vendorEmail: string
}

export function buildCategorizerPrompt(product: ProductData): string {
  return `Analyze the following product and provide categorization data for a gift recommendation system.

PRODUCT INFORMATION:
- Title: ${product.title}
- Description: ${product.description}
- Price: $${product.price}
- URL: ${product.originalUrl}

Please analyze this product and provide:
1. Relevant categories that describe this product
2. Target demographics (age ranges, interests, personalities)
3. Suitable occasions for gifting
4. A single sentence that captures the essence of this product for embedding generation

Respond in the following JSON format:
{
  "categories": ["category1", "category2", "category3"],
  "targetAge": ["age_range1", "age_range2"],
  "suitableFor": {
    "interests": ["interest1", "interest2"],
    "personalities": ["personality1", "personality2"],
    "occasions": ["occasion1", "occasion2"]
  },
  "embeddingSentence": "A concise sentence describing what makes this product special and who would love it"
}

Categories should be from: Technology, Sports, Reading, Cooking, Gaming, Fashion, Art, Music, Travel, Fitness, Gardening, Photography, Home Decor, Beauty, Wellness, Entertainment, Education, Outdoor, DIY, Pets

Age ranges: Under 18, 18-25, 26-35, 36-45, 46-55, 56-65, Over 65

Personalities: Adventurous, Creative, Practical, Intellectual, Social, Introverted, Luxury-loving, Minimalist

Occasions: Birthday, Christmas, Anniversary, Valentine's Day, Mother's Day, Father's Day, Graduation, Wedding, Baby Shower, Housewarming, Just Because`
}

export function extractEmbeddingText(
  product: ProductData,
  analysis: any
): string {
  return (
    analysis.embeddingSentence ||
    `${product.title} - ${product.description.slice(0, 200)}`
  )
}

import OpenAI from 'openai'
import { isAmazonUrl, isAllowedAffiliate } from './affiliates'
import { AFFILIATE_ALLOWED_DOMAINS, AFFILIATE_REQUIRE_ALLOWED } from './config'

interface PerplexityProduct {
  title: string
  description: string
  price: number
  url: string
  imageUrl?: string
  categories: string[]
}

// We'll use OpenAI compatible API for Perplexity
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
})

export async function searchGiftProducts(query: string): Promise<PerplexityProduct[]> {
  if (!process.env.PERPLEXITY_API_KEY) {
    console.log('No Perplexity API key found, skipping product search')
    return []
  }

  try {
    console.log('[Perplexity] searchGiftProducts query:', (query || '').slice(0, 160))
    const searchPrompt = `
Find 15 specific gift products that match this description: "${query}"

RULES:
- Only include results from Amazon (amazon.* domains or amzn.to short links).
- Provide the direct Amazon product URL with ASIN when possible.
- Include an image URL.

Return JSON array with fields:
[
  {
    "title": "Actual Product Name",
    "description": "Compelling 1-2 sentence description",
    "price": 99.99,
    "url": "https://www.amazon.com/dp/B0C123ASIN",
    "imageUrl": "https://images-na.ssl-images-amazon.com/images/I/...jpg",
    "categories": ["category1", "category2"]
  }
]
`

    const modelCandidates = [
      'gpt-5.0-mini',
      'gpt-5.0-nano',
      'sonar-small-online',
    ]

    let response: any = null
    let lastErr: any = null
    for (const m of modelCandidates) {
      try {
        console.log('[Perplexity] Trying model:', m)
        response = await perplexity.responses.create({
          model: m,
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: searchPrompt },
              ],
            },
          ],
        })
        const contentBlocks = response?.output?.[0]?.content
        const textBlock = contentBlocks?.find((block: any) => block.type === 'output_text')
        if (textBlock?.text) break
      } catch (err) {
        lastErr = err
        console.log('[Perplexity] Model failed:', m, err instanceof Error ? err.message : String(err))
        continue
      }
    }
    const contentBlocks = response?.output?.[0]?.content
    const textBlock = contentBlocks?.find((block: any) => block.type === 'output_text')

    if (!textBlock?.text) {
      throw lastErr || new Error('Perplexity returned no content')
    }

    const content = textBlock.text
    if (!content) {
      throw new Error('No response from Perplexity')
    }

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Perplexity response')
    }

    const products = JSON.parse(jsonMatch[0])
    console.log('[Perplexity] Raw parsed items:', Array.isArray(products) ? products.length : 0)
    
    // Validate and clean the products
    const cleaned = products.filter((product: any) => 
      product.title && 
      product.description && 
      product.price && 
      product.url &&
      product.categories
    ).map((product: any) => ({
      title: product.title,
      description: product.description,
      price: Number(product.price),
      url: product.url,
      categories: Array.isArray(product.categories) ? product.categories : [product.categories],
      imageUrl: product.imageUrl || undefined
    }))

    // Restrict to allowlist (default: Amazon-only)
    const filtered = cleaned.filter((p: any) => isAllowedAffiliate(p.url, AFFILIATE_ALLOWED_DOMAINS, AFFILIATE_REQUIRE_ALLOWED))
    console.log('[Perplexity] Allowlisted items:', filtered.length, 'of', cleaned.length)
    return filtered

  } catch (error) {
    console.error('Perplexity search failed:', error)
    return []
  }
}

export function buildPerplexityQuery(formData: any): string {
  const {
    ageRange,
    gender,
    relationship,
    occasion,
    budget,
    interests,
    personality,
    living,
    giftType,
    context,
    location,
  } = formData || {}

  return `
Gift for ${gender || 'recipient'} aged ${ageRange || 'unknown'}, ${relationship || 'unknown'} relationship, for ${occasion || 'a special occasion'}.
Budget: ${budget || 'flexible'}.
Interests: ${Array.isArray(interests) ? interests.join(', ') : interests || 'none'}.
Personality: ${typeof personality === 'string' ? personality : Array.isArray(personality) ? personality.join(', ') : 'unspecified'}.
Living situation: ${living || 'unspecified'}.
Preferred gift type: ${typeof giftType === 'string' ? giftType : Array.isArray(giftType) ? giftType.join(', ') : 'no preference'}.
Additional context: ${context || 'none'}.
${location ? `Location emphasis: consider options relevant to ${location}.` : ''}
  `.trim()
}
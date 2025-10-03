import OpenAI from 'openai'

import { RankedProduct, SessionProfile } from './types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

interface RerankOptions {
  session: SessionProfile
  topN?: number
}

interface LlmRerankResponse {
  order: string[]
}

const DEFAULT_MODEL = process.env.RECS_LLM_RERANK_MODEL || 'gpt-4.1-mini'

const MAX_TOP_N = 30

export async function applyLlmRerank(products: RankedProduct[], { session, topN }: RerankOptions): Promise<RankedProduct[]> {
  if (!products.length) return products

  const sliceCount = Math.min(topN ?? 20, MAX_TOP_N, products.length)
  const subset = products.slice(0, sliceCount)

  const promptItems = subset
    .map((product, index) => {
      const price = product.price ? `${product.price.toFixed(2)} ${product.currency || 'USD'}` : 'N/A'
      const categories = (product.categories || []).slice(0, 5).join(', ')
      return `${index + 1}. id=${product.id} | title=${product.title} | price=${price} | categories=${categories}`
    })
    .join('\n')

  const preferenceSummary = session?.constraints?.interests?.length
    ? session.constraints.interests.join(', ')
    : 'general gift shopper'

  const userPrompt = `You are re-ranking gift recommendations. The user cares about: ${preferenceSummary}.
Return the best order of the items below as JSON with key "order" that contains an array of item ids in your recommended order. You may optionally drop items that are irrelevant, but keep at least 10 when possible.
Items:\n${promptItems}`

  try {
    const response = await openai.responses.create({
      model: DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: 'You only respond with strict JSON. No extra commentary.',
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.2,
      max_output_tokens: 400,
    })

    const output = response.output_text?.trim() || ''
    if (!output) return products

    const parsed = JSON.parse(output) as LlmRerankResponse
    if (!Array.isArray(parsed.order)) return products

    const idToProduct = new Map(products.map((product) => [product.id, product]))
    const ordered: RankedProduct[] = []
    const seen = new Set<string>()

    for (const id of parsed.order) {
      if (typeof id !== 'string') continue
      const match = idToProduct.get(id)
      if (match && !seen.has(id)) {
        ordered.push(match)
        seen.add(id)
      }
    }

    for (const product of products) {
      if (!seen.has(product.id)) {
        ordered.push(product)
        seen.add(product.id)
      }
    }

    return ordered.map((product, index) => ({
      ...product,
      rank: index + 1,
    }))
  } catch (error) {
    console.log('[recs][llm-rerank] failed, falling back to heuristic order', error)
    return products
  }
}



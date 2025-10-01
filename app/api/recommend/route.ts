import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { rateLimit } from '@/lib/utils'
import { buildGiftPrompt, buildSearchQuery, GiftFormData } from '@/prompts/GiftPrompt'
import { buildAffiliateUrl } from '@/lib/affiliates'
import {
  ENABLE_SPONSORED_SLOTS,
  SPONSORED_DENSITY_CAP,
  MIN_SPONSORED_RELEVANCE,
  SPONSORED_SLOT_INDICES,
} from '@/lib/config'
import { searchGiftProducts, buildPerplexityQuery } from '@/lib/perplexity'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const prisma = new PrismaClient()

// Remove edge runtime - Prisma doesn't support it
// export const runtime = 'edge'

// Vendor tier boost multipliers
const TIER_BOOSTS = {
  ENTERPRISE: 2.0,
  FEATURED: 1.75,
  PREMIUM: 1.5,
  BASIC: 1.0,
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'anon'
    if (!rateLimit(`rec:${ip}`, 60)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }
    const body = await request.json()
    const { formData, userId } = body as { formData: GiftFormData; userId?: string }

    // Generate gift recommendations using OpenAI (tolerate missing key/offline)
    const prompt = buildGiftPrompt(formData)
    let recommendations: any[] = []
    try {
      console.log('[Recommend] Building chat prompt')
      const completion = await openai.responses.create({
        model: process.env.OPENAI_GIFT_MODEL || 'gpt-5.0-mini',
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: 'You are a helpful gift recommendation assistant. Always respond with valid JSON.' }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
          },
        ],
        temperature: 0.8,
      })

      const outputText = completion.output_text
        ? completion.output_text
        : completion.output
            ?.flatMap((segment: any) => segment.content || [])
            .filter((segment: any) => segment.type === 'output_text')
            .map((segment: any) => segment.text)
            .join('') ||
          '{}'

      const aiResponse = JSON.parse(outputText)
      console.log('[Recommend] AI recs count:', Array.isArray(aiResponse.recommendations) ? aiResponse.recommendations.length : 0)
      recommendations = aiResponse.recommendations || []
    } catch (aiError) {
      console.log('AI chat failed; continuing without initial recommendations:', aiError)
      recommendations = []
    }

    // Generate embedding for the user's preferences
    const userPreferenceText = `${formData.occasion} gift for ${formData.relationship} who is ${formData.personality} and likes ${formData.interests.join(', ')}`
    let userEmbedding: number[] | null = null
    try {
      const userEmbeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userPreferenceText,
      })
      userEmbedding = userEmbeddingResponse.data[0].embedding
    } catch (embedError) {
      console.log('Embedding generation failed; skipping vector search:', embedError)
      userEmbedding = null
    }

    // Convert embedding to vector string format (if available)
    const vectorString = userEmbedding && userEmbedding.length ? `[${userEmbedding.join(',')}]` : ''

    let vendorProducts: any[] = []
    let affiliateProducts: any[] = []

    if (vectorString) {
      try {
        // Find vendor products that match and are in stock with quality
        vendorProducts = await prisma.$queryRaw`
          SELECT 
            id, title, description, price, images, "affiliateUrl", categories,
            retailer, source, availability, "vendorEmail", status,
            1 - (embedding <=> ${vectorString}::vector) as similarity
          FROM "Product"
          WHERE status = 'APPROVED'
            AND "vendorEmail" IS NOT NULL
            AND availability != 'OUT_OF_STOCK'
            AND price > 0
            AND array_length(images, 1) > 0
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 40
        ` as any[]

        // Find affiliate products (non-vendor)
        affiliateProducts = await prisma.$queryRaw`
          SELECT 
            id, title, description, price, images, "affiliateUrl", categories,
            retailer, source, availability,
            1 - (embedding <=> ${vectorString}::vector) as similarity
          FROM "Product"
          WHERE status = 'APPROVED'
            AND "vendorEmail" IS NULL
            AND availability != 'OUT_OF_STOCK'
            AND price > 0
            AND array_length(images, 1) > 0
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 40
        ` as any[]
      } catch (vectorError) {
        console.log('Vector search failed, falling back to simple product query:', vectorError)
        try {
          // Fallback: Get products without vector similarity
          vendorProducts = await prisma.product.findMany({
            where: {
              status: 'APPROVED',
              vendorEmail: { not: null },
              NOT: { availability: 'OUT_OF_STOCK' },
              price: { gt: 0 },
            },
            take: 20,
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              images: true,
              affiliateUrl: true,
              categories: true,
              vendorEmail: true,
              status: true,
              availability: true,
              source: true,
              retailer: true,
            }
          })

          affiliateProducts = await prisma.product.findMany({
            where: {
              status: 'APPROVED',
              vendorEmail: null,
              NOT: { availability: 'OUT_OF_STOCK' },
              price: { gt: 0 },
            },
            take: 10,
            select: {
              id: true,
              title: true,
              description: true,
              price: true,
              images: true,
              affiliateUrl: true,
              categories: true,
              vendorEmail: true,
              status: true,
              availability: true,
              source: true,
              retailer: true,
            }
          })

          // Add default similarity scores for fallback products
          vendorProducts = vendorProducts.map(p => ({ ...p, similarity: 0.5 }))
          affiliateProducts = affiliateProducts.map(p => ({ ...p, similarity: 0.5 }))
        } catch (dbError) {
          console.log('Database fallback failed; proceeding with search/placeholders only:', dbError)
          vendorProducts = []
          affiliateProducts = []
        }
      }
    }

    // Combine and prioritize products
    // Budget filter: crude clamp
    const budget = (formData.budget || '').toLowerCase()
    const [minBudget, maxBudget] = (() => {
      const num = (s: string) => Number((s || '').replace(/[^0-9.]/g, '')) || 0
      if (budget.includes('under')) return [0, num(budget)]
      if (budget.includes('over')) return [num(budget), Infinity]
      const m = budget.match(/(\d+)[^\d]+(\d+)/)
      if (m) return [Number(m[1]), Number(m[2])]
      return [0, Infinity]
    })()

    const priceInBudget = (p: number) => p >= minBudget && p <= maxBudget

    const allProducts = [...vendorProducts, ...affiliateProducts]
      .filter(p => Array.isArray(p.images) && p.images.length > 0)
      .filter(p => typeof p.price === 'number' && priceInBudget(p.price))

    // Sort by priority: vendor products first (by tier), then by match score
    const prioritizedProducts = allProducts
      .map(product => {
        // Calculate demographic match score
        let matchScore = product.similarity || 0.5
        
        // Apply vendor tier boost (use Vendor.plan if available via join later; here simple boost)
        if (product.vendorEmail) {
          matchScore *= 1.3
        }
        
        // Check demographic matching
        const productCategories = product.categories || []
        const matchingInterests = formData.interests.filter(interest => 
          productCategories.some((cat: string) => 
            cat.toLowerCase().includes(interest.toLowerCase())
          )
        )
        
        if (matchingInterests.length > 0) {
          matchScore *= (1 + matchingInterests.length * 0.2)
        }
        
        return {
          ...product,
          finalScore: matchScore,
          isVendor: !!product.vendorEmail
        }
      })
      .sort((a, b) => {
        // Vendor products first
        if (a.isVendor && !b.isVendor) return -1
        if (!a.isVendor && b.isVendor) return 1
        // Then by score
        return b.finalScore - a.finalScore
      })
      .slice(0, 30) // Get up to 30 recommendations

    // Sponsored slot allocator (hooks only).
    // Reserve specific indices for sponsored items subject to density cap and relevance threshold.
    const applySponsoredSlots = (items: any[]) => {
      if (!ENABLE_SPONSORED_SLOTS || items.length === 0) return items.map(p => ({ ...p, sponsored: false }))

      const maxSponsoredByCap = Math.max(0, Math.floor(items.length * SPONSORED_DENSITY_CAP))
      const allowedSlots = SPONSORED_SLOT_INDICES.filter(i => i < items.length)
      const maxSponsored = Math.min(maxSponsoredByCap, allowedSlots.length)

      const sponsoredCandidates = items
        .filter(p => p.isVendor && (p.finalScore ?? 0) >= MIN_SPONSORED_RELEVANCE)
        .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))

      const chosenSponsored: any[] = sponsoredCandidates.slice(0, maxSponsored)
      const chosenIds = new Set(chosenSponsored.map(p => p.id))

      const organicPool: any[] = items.filter(p => !chosenIds.has(p.id))

      const slotted: any[] = []
      let sponsorIdx = 0
      let organicIdx = 0
      for (let pos = 0; pos < items.length; pos++) {
        const isReserved = allowedSlots.includes(pos)
        if (isReserved && sponsorIdx < chosenSponsored.length) {
          slotted.push({ ...chosenSponsored[sponsorIdx++], sponsored: true })
        } else if (organicIdx < organicPool.length) {
          // If a reserved slot has no sponsor left, fill with organic
          slotted.push({ ...organicPool[organicIdx++], sponsored: false })
        } else if (sponsorIdx < chosenSponsored.length) {
          // Fallback: if organic exhausted, place remaining sponsors as organic
          slotted.push({ ...chosenSponsored[sponsorIdx++], sponsored: false })
        } else {
          // Safety fallback (should not happen): repeat last organic
          const last = slotted[slotted.length - 1] ?? items[0]
          slotted.push({ ...last, sponsored: false })
        }
      }

      return slotted
    }

    const slottedProducts = applySponsoredSlots(prioritizedProducts)

    // Format the recommendations
    const enhancedRecommendations = slottedProducts.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      imageUrl: product.images?.[0] || '',
      affiliateUrl: buildAffiliateUrl(product.affiliateUrl),
      matchScore: product.finalScore,
      categories: product.categories,
      isVendor: product.isVendor,
      sponsored: Boolean(product.sponsored),
    }))

    // Do not add live search or placeholders in request path. If <12, return fewer with honesty.

    // Generate session ID for tracking and log impression
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    try {
      await prisma.recommendLog.create({
        data: {
          sessionId,
          userId: userId || null,
          productIds: enhancedRecommendations.map(p => String(p.id)),
          resultsCount: enhancedRecommendations.length,
        }
      })
    } catch (e) {
      console.log('RecommendLog create failed:', e)
    }

    return NextResponse.json({
      recommendations: enhancedRecommendations,
      sessionId,
    })
  } catch (error) {
    console.error('Error in recommend API:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
} 
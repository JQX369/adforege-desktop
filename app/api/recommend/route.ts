import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
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
    const body = await request.json()
    const { formData, userId } = body as { formData: GiftFormData; userId?: string }

    // Generate gift recommendations using OpenAI (tolerate missing key/offline)
    const prompt = buildGiftPrompt(formData)
    let recommendations: any[] = []
    try {
      console.log('[Recommend] Building chat prompt')
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful gift recommendation assistant. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      })
      const aiResponse = JSON.parse(completion.choices[0].message.content || '{}')
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
        // Find vendor products that match demographics
        vendorProducts = await prisma.$queryRaw`
          SELECT 
            id, title, description, price, images, "affiliateUrl", categories,
            1 - (embedding <=> ${vectorString}::vector) as similarity,
            "vendorEmail", status
          FROM "Product"
          WHERE status = 'APPROVED'
            AND "vendorEmail" IS NOT NULL
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 20
        ` as any[]

        // Find affiliate products (non-vendor)
        affiliateProducts = await prisma.$queryRaw`
          SELECT 
            id, title, description, price, images, "affiliateUrl", categories,
            1 - (embedding <=> ${vectorString}::vector) as similarity
          FROM "Product"
          WHERE status = 'APPROVED'
            AND "vendorEmail" IS NULL
          ORDER BY embedding <=> ${vectorString}::vector
          LIMIT 10
        ` as any[]
      } catch (vectorError) {
        console.log('Vector search failed, falling back to simple product query:', vectorError)
        try {
          // Fallback: Get products without vector similarity
          vendorProducts = await prisma.product.findMany({
            where: {
              status: 'APPROVED',
              vendorEmail: { not: null }
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
            }
          })

          affiliateProducts = await prisma.product.findMany({
            where: {
              status: 'APPROVED',
              vendorEmail: null
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
    const allProducts = [...vendorProducts, ...affiliateProducts]

    // Sort by priority: vendor products first (by tier), then by match score
    const prioritizedProducts = allProducts
      .map(product => {
        // Calculate demographic match score
        let matchScore = product.similarity || 0.5
        
        // Apply vendor tier boost (would need tier field in schema)
        if (product.vendorEmail) {
          // For now, give all vendor products a boost
          matchScore *= 1.5 // This would use TIER_BOOSTS based on actual tier
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

    // If we don't have enough products, search for real products using Perplexity
    if (enhancedRecommendations.length < 12) {
      console.log(`[Recommend] Only ${enhancedRecommendations.length} products found, searching for more...`)
      
      try {
        const origin = new URL(request.url).origin
        const searchQuery = buildPerplexityQuery(formData) + `\n\nConstraints: Only include URLs from these domains: ${process.env.AFFILIATE_ALLOWED_DOMAINS || 'amazon.com, amzn.to'}.`
        const searchResults = await searchGiftProducts(searchQuery)
        console.log('[Recommend] Search results:', searchResults.length)
        
        const targetCount = Math.max(12 - enhancedRecommendations.length, 0)
        const searchBasedProducts = searchResults.slice(0, targetCount).map((product) => ({
          id: `search-${Date.now()}-${Math.random()}`,
          title: product.title,
          description: product.description,
          price: product.price,
          imageUrl: product.imageUrl || '',
          affiliateUrl: buildAffiliateUrl(product.url),
          matchScore: 0.7, // Give search results a good match score
          categories: product.categories,
          isVendor: false,
          isSearchResult: true,
          sponsored: false,
        }))

        enhancedRecommendations.push(...searchBasedProducts)
        
        if (searchBasedProducts.length > 0) {
          console.log(`Added ${searchBasedProducts.length} products from search`)
        }
        // If still not enough (e.g., Perplexity returned nothing), fill with placeholders
        if (enhancedRecommendations.length < 12) {
          const needed = 12 - enhancedRecommendations.length
          const aiBased = (recommendations || []).slice(0, needed).map((rec: any) => ({
            id: `placeholder-${Date.now()}-${Math.random()}`,
            title: rec.title || 'Thoughtful Gift Idea',
            description: rec.description || 'A well-reviewed gift idea suitable for the recipient.',
            price: 0,
            imageUrl: '',
            affiliateUrl: '#',
            matchScore: 0.5,
            categories: rec.category || [],
            isVendor: false,
            sponsored: false,
          }))
          if (aiBased.length > 0) {
            enhancedRecommendations.push(...aiBased)
          } else {
            const defaults = Array.from({ length: needed }).map((_, idx) => ({
              id: `default-${Date.now()}-${idx}-${Math.random()}`,
              title: `${formData.occasion || 'Gift'} Idea ${idx + 1}`,
              description: `A versatile gift option for a ${formData.relationship || 'recipient'} who enjoys ${formData.interests?.[0] || 'great gifts'}.`,
              price: 0,
              imageUrl: '',
              affiliateUrl: '#',
              matchScore: 0.45,
              categories: Array.isArray(formData.interests) ? [formData.interests[0]] : [],
              isVendor: false,
              sponsored: false,
            }))
            enhancedRecommendations.push(...defaults)
          }
        }
      } catch (searchError) {
        console.log('Search failed, falling back to AI placeholders:', searchError)
        
        // Fallback to AI-generated placeholders
        const needed = 30 - enhancedRecommendations.length
        const aiBased = recommendations.slice(0, needed).map((rec: any) => ({
          id: `placeholder-${Date.now()}-${Math.random()}`,
          title: rec.title || 'Thoughtful Gift Idea',
          description: rec.description || 'A well-reviewed gift idea suitable for the recipient.',
          price: 0,
          imageUrl: '',
          affiliateUrl: '#',
          matchScore: 0.5,
          categories: rec.category || [],
          isVendor: false,
          sponsored: false,
        }))

        if (aiBased.length > 0) {
          enhancedRecommendations.push(...aiBased)
        } else {
          const defaults = Array.from({ length: needed }).map((_, idx) => ({
            id: `default-${Date.now()}-${idx}-${Math.random()}`,
            title: `${formData.occasion || 'Gift'} Idea ${idx + 1}`,
            description: `A versatile gift option for a ${formData.relationship || 'recipient'} who enjoys ${formData.interests?.[0] || 'great gifts'}.`,
            price: 0,
            imageUrl: '',
            affiliateUrl: '#',
            matchScore: 0.45,
            categories: Array.isArray(formData.interests) ? [formData.interests[0]] : [],
            isVendor: false,
            sponsored: false,
          }))
          enhancedRecommendations.push(...defaults)
        }
      }
    }

    // Generate session ID for tracking
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

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
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/utils'
import { GiftFormData } from '@/prompts/GiftPrompt'
import { buildAffiliateUrl } from '@/lib/affiliates'
import { getRecommendations } from '@/lib/recs'
import { appendSeenIds, buildSessionProfile } from '@/lib/recs/session'
import { logImpressions } from '@/lib/recs/events'
import { resolveGeo } from '@/lib/geo'
import { logError } from '@/lib/log'

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'anon'
    if (!rateLimit(`rec:${ip}`, 60)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }
    const body = await request.json()
    const { formData, userId, page = 0 } = body as { formData: GiftFormData; userId?: string; page?: number }

    const geoInfo = await resolveGeo(request.headers)

    const preferenceText = `${formData.occasion} gift for ${formData.relationship} who is ${formData.personality} and likes ${(formData.interests || []).join(', ')}`
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const constraints = {
      interests: formData.interests || [],
      occasion: formData.occasion,
      relationship: formData.relationship,
      minPrice: undefined,
      maxPrice: undefined,
      seenIds: [],
      excludeIds: [],
    }

    const sessionProfile = await buildSessionProfile(sessionId, preferenceText, constraints)

    const recs = await getRecommendations({
      session: sessionProfile,
      page,
      pageSize: 30,
      country: geoInfo.country,
      region: geoInfo.country,
    })

    const recommendations = recs.products.map(product => ({
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      imageUrl: product.images?.[0] || '',
      affiliateUrl: buildAffiliateUrl(product.affiliateUrl, geoInfo.country),
      matchScore: product.finalScore,
      categories: product.categories,
      isVendor: Boolean(product.vendorEmail),
      sponsored: Boolean(product.sponsored),
      vendor: product.retailer,
      badges: product.badges,
      currency: product.currency ?? geoInfo.currency,
      deliveryDays: product.deliveryDays,
    }))

    const recommendationIds = recommendations.map((product) => product.id)

    await Promise.all([
      appendSeenIds(sessionId, recommendationIds),
      logImpressions({ sessionId, userId, productIds: recommendationIds }),
    ])

    return NextResponse.json({
      recommendations,
      sessionId,
      page,
      hasMore: recs.hasMore,
    })
  } catch (error) {
    logError('Error in recommend API', { error })
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
} 
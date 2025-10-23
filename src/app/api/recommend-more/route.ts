import { NextRequest, NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/recs'
import { loadSessionProfile } from '@/lib/recs/session'
import { resolveGeo } from '@/src/shared/constants/geo'
import { buildAffiliateUrl } from '@/lib/affiliates'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, page = 1 } = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }

    const sessionProfile = await loadSessionProfile(sessionId)
    if (!sessionProfile) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const geoInfo = await resolveGeo(request.headers)

    const recs = await getRecommendations({
      session: sessionProfile,
      page,
      pageSize: 30,
      country: geoInfo.country,
      region: geoInfo.country,
    })

    return NextResponse.json({
      recommendations: recs.products.map((product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        imageUrl: product.images?.[0] || '',
        affiliateUrl: product.affiliateUrl,
        matchScore: product.finalScore,
        categories: product.categories,
        isVendor: Boolean(product.vendorEmail),
        badges: product.badges,
        currency: product.currency ?? geoInfo.currency,
        deliveryDays: product.deliveryDays,
      })),
      page,
      hasMore: recs.hasMore,
    })
  } catch (error) {
    console.error('Error in recommend-more API:', error)
    return NextResponse.json(
      { error: 'Failed to get more recommendations' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get('range') || '7d'

    // Calculate date range
    const now = new Date()
    const startDate = new Date(now)

    switch (range) {
      case '1d':
        startDate.setDate(now.getDate() - 1)
        break
      case '7d':
        startDate.setDate(now.getDate() - 7)
        break
      case '30d':
        startDate.setDate(now.getDate() - 30)
        break
      case '90d':
        startDate.setDate(now.getDate() - 90)
        break
      default:
        startDate.setDate(now.getDate() - 7)
    }

    // Get traffic source data
    const trafficData = await prisma.analyticsEvent.groupBy({
      by: ['referrer'],
      where: {
        timestamp: { gte: startDate },
        event: 'page_view',
        referrer: { not: null },
      },
      _count: { referrer: true },
    })

    // Transform data for frontend
    const trafficSources = trafficData.map((source) => ({
      source: source.referrer || 'Direct',
      visitors: source._count.referrer,
      sessions: source._count.referrer, // Simplified
      conversions: 0, // Placeholder
    }))

    return NextResponse.json(trafficSources)
  } catch (error) {
    console.error('Failed to get traffic sources:', error)
    return NextResponse.json(
      { error: 'Failed to get traffic sources' },
      { status: 500 }
    )
  }
}

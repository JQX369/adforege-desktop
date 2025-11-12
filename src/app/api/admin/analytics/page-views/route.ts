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

    // Get page view data
    const pageViews = await prisma.analyticsEvent.groupBy({
      by: ['page'],
      where: {
        timestamp: { gte: startDate },
        event: 'page_view',
        page: { not: null },
      },
      _count: { page: true },
    })

    // Transform data for frontend
    const pageViewData = pageViews.map((page) => ({
      page: page.page || 'Unknown',
      views: page._count.page,
      uniqueViews: page._count.page, // Simplified
      avgTimeOnPage: 45, // Placeholder
    }))

    return NextResponse.json(pageViewData)
  } catch (error) {
    console.error('Failed to get page views:', error)
    return NextResponse.json(
      { error: 'Failed to get page views' },
      { status: 500 }
    )
  }
}

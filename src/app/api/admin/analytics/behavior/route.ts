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

    // Get user behavior data
    const behaviorData = await prisma.analyticsEvent.groupBy({
      by: ['event'],
      where: {
        timestamp: { gte: startDate },
      },
      _count: { event: true },
      _avg: {
        // This would need additional fields in the schema
      },
    })

    // Transform data for frontend
    const behaviorEvents = behaviorData.map((event) => ({
      event: event.event,
      count: event._count.event,
      uniqueUsers: event._count.event, // Simplified
      avgValue: 0, // Placeholder
    }))

    return NextResponse.json(behaviorEvents)
  } catch (error) {
    console.error('Failed to get user behavior:', error)
    return NextResponse.json(
      { error: 'Failed to get user behavior' },
      { status: 500 }
    )
  }
}

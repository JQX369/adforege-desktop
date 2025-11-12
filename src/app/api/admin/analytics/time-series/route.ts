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

    // Get time series data
    const timeSeriesData = await prisma.analyticsEvent.groupBy({
      by: ['timestamp'],
      where: {
        timestamp: { gte: startDate },
      },
      _count: { timestamp: true },
    })

    // Transform data for frontend
    const timeSeries = timeSeriesData.map((data) => ({
      date: data.timestamp.toISOString().split('T')[0],
      users: data._count.timestamp, // Simplified
      sessions: data._count.timestamp, // Simplified
      pageViews: data._count.timestamp, // Simplified
      conversions: 0, // Placeholder
    }))

    return NextResponse.json(timeSeries)
  } catch (error) {
    console.error('Failed to get time series data:', error)
    return NextResponse.json(
      { error: 'Failed to get time series data' },
      { status: 500 }
    )
  }
}

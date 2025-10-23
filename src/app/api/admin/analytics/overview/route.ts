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

    // Get analytics metrics
    const [
      totalUsers,
      totalSessions,
      totalPageViews,
      totalConversions,
      averageSessionDuration,
      bounceRate,
      revenue,
    ] = await Promise.all([
      // Total unique users
      prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          timestamp: { gte: startDate },
          userId: { not: null },
        },
        _count: { userId: true },
      }),

      // Total sessions
      prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: {
          timestamp: { gte: startDate },
        },
        _count: { sessionId: true },
      }),

      // Total page views
      prisma.analyticsEvent.count({
        where: {
          timestamp: { gte: startDate },
          event: 'page_view',
        },
      }),

      // Total conversions
      prisma.analyticsEvent.count({
        where: {
          timestamp: { gte: startDate },
          event: 'conversion',
        },
      }),

      // Average session duration (simplified)
      prisma.analyticsEvent.aggregate({
        where: {
          timestamp: { gte: startDate },
          event: 'session_duration',
        },
        _avg: {
          // This would need a duration field in the schema
        },
      }),

      // Bounce rate (simplified)
      prisma.analyticsEvent.count({
        where: {
          timestamp: { gte: startDate },
          event: 'bounce',
        },
      }),

      // Revenue from affiliate clicks
      prisma.analyticsEvent.aggregate({
        where: {
          timestamp: { gte: startDate },
          event: 'conversion',
          properties: {
            path: ['conversionType'],
            equals: 'affiliate_click',
          },
        },
        _sum: {
          // This would need a value field in the schema
        },
      }),
    ])

    const overview = {
      totalUsers: totalUsers.length,
      totalSessions: totalSessions.length,
      totalPageViews,
      totalConversions,
      conversionRate:
        totalSessions.length > 0
          ? (totalConversions / totalSessions.length) * 100
          : 0,
      averageSessionDuration: 245, // Placeholder
      bounceRate: 32.5, // Placeholder
      revenue: 45680.5, // Placeholder
    }

    return NextResponse.json(overview)
  } catch (error) {
    console.error('Failed to get analytics overview:', error)
    return NextResponse.json(
      { error: 'Failed to get analytics overview' },
      { status: 500 }
    )
  }
}

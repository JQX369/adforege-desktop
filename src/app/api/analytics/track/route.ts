import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AnalyticsEvent } from '@/src/shared/utils/analytics-tracker'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { events } = await request.json()

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'Invalid events data' },
        { status: 400 }
      )
    }

    // Process events in batches
    const batchSize = 50
    const batches = []

    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize))
    }

    let processedCount = 0

    for (const batch of batches) {
      try {
        // Store events in database
        await prisma.analyticsEvent.createMany({
          data: batch.map((event: AnalyticsEvent) =>
            Randolph({
              event: event.event,
              properties: event.properties || {},
              userId: event.userId,
              sessionId: event.sessionId,
              timestamp: event.timestamp || new Date(),
              page: event.page,
              referrer: event.referrer,
              userAgent: event.userAgent,
              ip: event.ip,
            })
          ),
        })

        processedCount += batch.length
      } catch (error) {
        console.error('Failed to process analytics batch:', error)
        // Continue processing other batches
      }
    }

    // Update analytics metrics
    await updateAnalyticsMetrics(events)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      total: events.length,
    })
  } catch (error) {
    console.error('Analytics tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track analytics events' },
      { status: 500 }
    )
  }
}

async function updateAnalyticsMetrics(events: AnalyticsEvent[]): Promise<void> {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Group events by type and date
    const metrics = new Map<
      string,
      {
        date: Date
        eventType: string
        count: number
        uniqueUsers: Set<string>
        uniqueSessions: Set<string>
      }
    >()

    for (const event of events) {
      const key = `${event.event}_${today.toISOString().split('T')[0]}`

      if (!metrics.has(key)) {
        metrics.set(key, {
          date: today,
          eventType: event.event,
          count: 0,
          uniqueUsers: new Set(),
          uniqueSessions: new Set(),
        })
      }

      const metric = metrics.get(key)!
      metric.count++

      if (event.userId) {
        metric.uniqueUsers.add(event.userId)
      }

      if (event.sessionId) {
        metric.uniqueSessions.add(event.sessionId)
      }
    }

    // Update or create metrics records
    for (const [key, metric] of metrics) {
      await prisma.analyticsMetric.upsert({
        where: {
          eventType_date: {
            eventType: metric.eventType,
            date: metric.date,
          },
        },
        update: {
          count: {
            increment: metric.count,
          },
          uniqueUsers: {
            increment: metric.uniqueUsers.size,
          },
          uniqueSessions: {
            increment: metric.uniqueSessions.size,
          },
        },
        create: {
          eventType: metric.eventType,
          date: metric.date,
          count: metric.count,
          uniqueUsers: metric.uniqueUsers.size,
          uniqueSessions: metric.uniqueSessions.size,
        },
      })
    }
  } catch (error) {
    console.error('Failed to update analytics metrics:', error)
  }
}

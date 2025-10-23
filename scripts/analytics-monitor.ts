#!/usr/bin/env tsx

import { prisma } from '@/lib/prisma'

interface AnalyticsReport {
  overview: {
    totalEvents: number
    uniqueUsers: number
    uniqueSessions: number
    topEvents: Array<{ event: string; count: number }>
    topPages: Array<{ page: string; views: number }>
    topReferrers: Array<{ referrer: string; count: number }>
  }
  trends: {
    dailyEvents: Array<{ date: string; count: number }>
    hourlyEvents: Array<{ hour: number; count: number }>
    weeklyGrowth: number
  }
  insights: string[]
  recommendations: string[]
}

class AnalyticsMonitor {
  private static instance: AnalyticsMonitor

  static getInstance(): AnalyticsMonitor {
    if (!AnalyticsMonitor.instance) {
      AnalyticsMonitor.instance = new AnalyticsMonitor()
    }
    return AnalyticsMonitor.instance
  }

  async generateReport(days: number = 7): Promise<AnalyticsReport> {
    console.log(`📊 Generating analytics report for the last ${days} days...\n`)

    const now = new Date()
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    try {
      // Get overview data
      const [
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        topEvents,
        topPages,
        topReferrers,
        dailyEvents,
        hourlyEvents,
      ] = await Promise.all([
        this.getTotalEvents(startDate),
        this.getUniqueUsers(startDate),
        this.getUniqueSessions(startDate),
        this.getTopEvents(startDate),
        this.getTopPages(startDate),
        this.getTopReferrers(startDate),
        this.getDailyEvents(startDate),
        this.getHourlyEvents(startDate),
      ])

      // Calculate trends
      const weeklyGrowth = this.calculateWeeklyGrowth(dailyEvents)

      // Generate insights
      const insights = this.generateInsights({
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        topEvents,
        topPages,
        topReferrers,
        dailyEvents,
        weeklyGrowth,
      })

      // Generate recommendations
      const recommendations = this.generateRecommendations({
        totalEvents,
        uniqueUsers,
        uniqueSessions,
        topEvents,
        topPages,
        topReferrers,
        dailyEvents,
        weeklyGrowth,
      })

      const report: AnalyticsReport = {
        overview: {
          totalEvents,
          uniqueUsers,
          uniqueSessions,
          topEvents,
          topPages,
          topReferrers,
        },
        trends: {
          dailyEvents,
          hourlyEvents,
          weeklyGrowth,
        },
        insights,
        recommendations,
      }

      return report
    } catch (error) {
      console.error('Failed to generate analytics report:', error)
      throw error
    }
  }

  private async getTotalEvents(startDate: Date): Promise<number> {
    try {
      const result = await prisma.analyticsEvent.count({
        where: {
          timestamp: { gte: startDate },
        },
      })
      return result
    } catch (error) {
      console.error('Failed to get total events:', error)
      return 0
    }
  }

  private async getUniqueUsers(startDate: Date): Promise<number> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['userId'],
        where: {
          timestamp: { gte: startDate },
          userId: { not: null },
        },
      })
      return result.length
    } catch (error) {
      console.error('Failed to get unique users:', error)
      return 0
    }
  }

  private async getUniqueSessions(startDate: Date): Promise<number> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['sessionId'],
        where: {
          timestamp: { gte: startDate },
        },
      })
      return result.length
    } catch (error) {
      console.error('Failed to get unique sessions:', error)
      return 0
    }
  }

  private async getTopEvents(
    startDate: Date
  ): Promise<Array<{ event: string; count: number }>> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['event'],
        where: {
          timestamp: { gte: startDate },
        },
        _count: { event: true },
        orderBy: { _count: { event: 'desc' } },
        take: 10,
      })

      return result.map((item) => ({
        event: item.event,
        count: item._count.event,
      }))
    } catch (error) {
      console.error('Failed to get top events:', error)
      return []
    }
  }

  private async getTopPages(
    startDate: Date
  ): Promise<Array<{ page: string; views: number }>> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['page'],
        where: {
          timestamp: { gte: startDate },
          event: 'page_view',
          page: { not: null },
        },
        _count: { page: true },
        orderBy: { _count: { page: 'desc' } },
        take: 10,
      })

      return result.map((item) => ({
        page: item.page || 'Unknown',
        views: item._count.page,
      }))
    } catch (error) {
      console.error('Failed to get top pages:', error)
      return []
    }
  }

  private async getTopReferrers(
    startDate: Date
  ): Promise<Array<{ referrer: string; count: number }>> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['referrer'],
        where: {
          timestamp: { gte: startDate },
          event: 'page_view',
          referrer: { not: null },
        },
        _count: { referrer: true },
        orderBy: { _count: { referrer: 'desc' } },
        take: 10,
      })

      return result.map((item) => ({
        referrer: item.referrer || 'Direct',
        count: item._count.referrer,
      }))
    } catch (error) {
      console.error('Failed to get top referrers:', error)
      return []
    }
  }

  private async getDailyEvents(
    startDate: Date
  ): Promise<Array<{ date: string; count: number }>> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['timestamp'],
        where: {
          timestamp: { gte: startDate },
        },
        _count: { timestamp: true },
        orderBy: { timestamp: 'asc' },
      })

      return result.map((item) => ({
        date: item.timestamp.toISOString().split('T')[0],
        count: item._count.timestamp,
      }))
    } catch (error) {
      console.error('Failed to get daily events:', error)
      return []
    }
  }

  private async getHourlyEvents(
    startDate: Date
  ): Promise<Array<{ hour: number; count: number }>> {
    try {
      const result = await prisma.analyticsEvent.groupBy({
        by: ['timestamp'],
        where: {
          timestamp: { gte: startDate },
        },
        _count: { timestamp: true },
      })

      // Group by hour
      const hourlyData = new Map<number, number>()

      for (const item of result) {
        const hour = item.timestamp.getHours()
        hourlyData.set(
          hour,
          (hourlyData.get(hour) || 0) + item._count.timestamp
        )
      }

      return Array.from(hourlyData.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour)
    } catch (error) {
      console.error('Failed to get hourly events:', error)
      return []
    }
  }

  private calculateWeeklyGrowth(
    dailyEvents: Array<{ date: string; count: number }>
  ): number {
    if (dailyEvents.length < 7) return 0

    const firstWeek = dailyEvents.slice(0, 7)
    const secondWeek = dailyEvents.slice(7, 14)

    const firstWeekAvg =
      firstWeek.reduce((sum, day) => sum + day.count, 0) / firstWeek.length
    const secondWeekAvg =
      secondWeek.reduce((sum, day) => sum + day.count, 0) / secondWeek.length

    if (firstWeekAvg === 0) return 0

    return ((secondWeekAvg - firstWeekAvg) / firstWeekAvg) * 100
  }

  private generateInsights(data: any): string[] {
    const insights: string[] = []

    // Event volume insights
    if (data.totalEvents > 10000) {
      insights.push(
        'High event volume detected - system is handling significant traffic'
      )
    } else if (data.totalEvents < 1000) {
      insights.push('Low event volume - consider increasing user engagement')
    }

    // User engagement insights
    const eventsPerUser = data.totalEvents / data.uniqueUsers
    if (eventsPerUser > 10) {
      insights.push(
        'High user engagement - users are actively interacting with the platform'
      )
    } else if (eventsPerUser < 3) {
      insights.push(
        'Low user engagement - users may not be finding value in the platform'
      )
    }

    // Page performance insights
    if (data.topPages.length > 0) {
      const topPage = data.topPages[0]
      insights.push(
        `Most popular page: ${topPage.page} with ${topPage.views} views`
      )
    }

    // Traffic source insights
    if (data.topReferrers.length > 0) {
      const topReferrer = data.topReferrers[0]
      insights.push(
        `Top traffic source: ${topReferrer.referrer} with ${topReferrer.count} visits`
      )
    }

    // Growth insights
    if (data.weeklyGrowth > 20) {
      insights.push('Strong growth trend - platform is gaining momentum')
    } else if (data.weeklyGrowth < -10) {
      insights.push('Declining trend - investigate potential issues')
    }

    return insights
  }

  private generateRecommendations(data: any): string[] {
    const recommendations: string[] = []

    // Engagement recommendations
    if (data.totalEvents / data.uniqueUsers < 5) {
      recommendations.push(
        'Improve user engagement with interactive features and personalized content'
      )
    }

    // Page optimization recommendations
    if (data.topPages.length > 0) {
      const topPage = data.topPages[0]
      if (topPage.views > 1000) {
        recommendations.push(
          `Optimize ${topPage.page} for better conversion rates`
        )
      }
    }

    // Traffic source recommendations
    if (data.topReferrers.length > 0) {
      const topReferrer = data.topReferrers[0]
      if (topReferrer.referrer === 'Direct') {
        recommendations.push(
          'Focus on SEO and content marketing to reduce dependence on direct traffic'
        )
      }
    }

    // Growth recommendations
    if (data.weeklyGrowth < 0) {
      recommendations.push(
        'Investigate user retention strategies and improve user experience'
      )
    }

    // Event tracking recommendations
    if (data.topEvents.length > 0) {
      const topEvent = data.topEvents[0]
      if (
        topEvent.event === 'page_view' &&
        topEvent.count > data.totalEvents * 0.8
      ) {
        recommendations.push(
          'Implement more interactive events to track user engagement beyond page views'
        )
      }
    }

    return recommendations
  }

  async printReport(report: AnalyticsReport): Promise<void> {
    console.log('📈 Analytics Report')
    console.log('='.repeat(50))

    // Overview
    console.log('\n📊 Overview:')
    console.log(
      `  Total Events: ${report.overview.totalEvents.toLocaleString()}`
    )
    console.log(
      `  Unique Users: ${report.overview.uniqueUsers.toLocaleString()}`
    )
    console.log(
      `  Unique Sessions: ${report.overview.uniqueSessions.toLocaleString()}`
    )
    console.log(
      `  Events per User: ${(report.overview.totalEvents / report.overview.uniqueUsers).toFixed(2)}`
    )
    console.log(
      `  Events per Session: ${(report.overview.totalEvents / report.overview.uniqueSessions).toFixed(2)}`
    )

    // Top Events
    console.log('\n🔥 Top Events:')
    report.overview.topEvents.forEach((event, index) => {
      console.log(
        `  ${index + 1}. ${event.event}: ${event.count.toLocaleString()}`
      )
    })

    // Top Pages
    console.log('\n📄 Top Pages:')
    report.overview.topPages.forEach((page, index) => {
      console.log(
        `  ${index + 1}. ${page.page}: ${page.views.toLocaleString()} views`
      )
    })

    // Top Referrers
    console.log('\n🌐 Top Traffic Sources:')
    report.overview.topReferrers.forEach((referrer, index) => {
      console.log(
        `  ${index + 1}. ${referrer.referrer}: ${referrer.count.toLocaleString()} visits`
      )
    })

    // Trends
    console.log('\n📈 Trends:')
    console.log(`  Weekly Growth: ${report.trends.weeklyGrowth.toFixed(1)}%`)

    if (report.trends.hourlyEvents.length > 0) {
      const peakHour = report.trends.hourlyEvents.reduce((max, hour) =>
        hour.count > max.count ? hour : max
      )
      console.log(`  Peak Hour: ${peakHour.hour}:00 (${peakHour.count} events)`)
    }

    // Insights
    console.log('\n💡 Insights:')
    report.insights.forEach((insight) => {
      console.log(`  • ${insight}`)
    })

    // Recommendations
    console.log('\n🎯 Recommendations:')
    report.recommendations.forEach((recommendation) => {
      console.log(`  • ${recommendation}`)
    })

    console.log('\n' + '='.repeat(50))
  }
}

// Run the monitoring
async function main() {
  const monitor = AnalyticsMonitor.getInstance()

  try {
    const report = await monitor.generateReport(7)
    await monitor.printReport(report)
  } catch (error) {
    console.error('Analytics monitoring failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { AnalyticsMonitor }

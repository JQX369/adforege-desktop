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

    // Get device data
    const deviceData = await prisma.analyticsEvent.groupBy({
      by: ['userAgent'],
      where: {
        timestamp: { gte: startDate },
        event: 'page_view',
        userAgent: { not: null },
      },
      _count: { userAgent: true },
      _avg: {
        // This would need additional fields in the schema
      },
    })

    // Transform data for frontend (simplified device detection)
    const deviceBreakdown = deviceData.map((device) => {
      const userAgent = device.userAgent || 'Unknown'
      let deviceType = 'Desktop'

      if (userAgent.includes('Mobile')) {
        deviceType = 'Mobile'
      } else if (userAgent.includes('Tablet')) {
        deviceType = 'Tablet'
      }

      return {
        device: deviceType,
        count: device._count.userAgent,
        percentage: 0, // Will be calculated on frontend
      }
    })

    // Group by device type
    const groupedDevices = deviceBreakdown.reduce(
      (acc, device) => {
        const existing = acc.find((d) => d.device === device.device)
        if (existing) {
          existing.count += device.count
        } else {
          acc.push(device)
        }
        return acc
      },
      [] as typeof deviceBreakdown
    )

    // Calculate percentages
    const total = groupedDevices.reduce((sum, device) => sum + device.count, 0)
    groupedDevices.forEach((device) => {
      device.percentage = total > 0 ? (device.count / total) * 100 : 0
    })

    return NextResponse.json(groupedDevices)
  } catch (error) {
    console.error('Failed to get device breakdown:', error)
    return NextResponse.json(
      { error: 'Failed to get device breakdown' },
      { status: 500 }
    )
  }
}

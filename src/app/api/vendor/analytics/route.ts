import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') || '7d'
    const vendorId = searchParams.get('vendorId')

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      )
    }

    // Calculate date range based on timeframe
    let daysBack = 7
    switch (timeframe) {
      case '24h':
        daysBack = 1
        break
      case '7d':
        daysBack = 7
        break
      case '30d':
        daysBack = 30
        break
      case '90d':
        daysBack = 90
        break
    }

    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)

    // Get vendor products
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        products: {
          select: {
            id: true,
            title: true,
            images: true,
            price: true,
            currency: true,
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const productIds = vendor.products.map((p) => p.id)

    if (productIds.length === 0) {
      return NextResponse.json({
        overview: {
          totalProducts: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalSaves: 0,
          totalRevenue: 0,
          ctr: 0,
          saveRate: 0,
          conversionRate: 0,
        },
        trends: {
          impressions: [],
          clicks: [],
          saves: [],
          revenue: [],
        },
        topProducts: [],
        demographics: {
          ageGroups: [],
          genders: [],
          locations: [],
        },
        timeframes: {
          hourly: [],
          daily: [],
          weekly: [],
        },
      })
    }

    // Get events for the time period
    const events = await prisma.recommendationEvent.groupBy({
      by: ['productId', 'action'],
      where: {
        productId: { in: productIds },
        createdAt: { gte: startDate },
      },
      _count: { _all: true },
    })

    // Calculate overview metrics
    let totalImpressions = 0
    let totalClicks = 0
    let totalSaves = 0

    events.forEach((event) => {
      switch (event.action) {
        case 'IMPRESSION':
          totalImpressions += event._count._all
          break
        case 'CLICK':
          totalClicks += event._count._all
          break
        case 'SAVE':
          totalSaves += event._count._all
          break
      }
    })

    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
    const saveRate = totalImpressions > 0 ? totalSaves / totalImpressions : 0
    const conversionRate = totalClicks > 0 ? totalSaves / totalClicks : 0
    const totalRevenue = totalSaves * 0.1 // Simplified revenue calculation

    // Generate trends data (mock data for now)
    const trends = {
      impressions: generateTrendData(daysBack, totalImpressions),
      clicks: generateTrendData(daysBack, totalClicks),
      saves: generateTrendData(daysBack, totalSaves),
      revenue: generateTrendData(daysBack, totalRevenue),
    }

    // Calculate top products
    const productMetrics = vendor.products.map((product) => {
      const productEvents = events.filter((e) => e.productId === product.id)
      let impressions = 0
      let clicks = 0
      let saves = 0

      productEvents.forEach((event) => {
        switch (event.action) {
          case 'IMPRESSION':
            impressions += event._count._all
            break
          case 'CLICK':
            clicks += event._count._all
            break
          case 'SAVE':
            saves += event._count._all
            break
        }
      })

      const ctr = impressions > 0 ? clicks / impressions : 0
      const saveRate = impressions > 0 ? saves / impressions : 0
      const revenue = saves * 0.1

      return {
        id: product.id,
        title: product.title,
        imageUrl: product.images?.[0] || '',
        price: product.price,
        currency: product.currency,
        impressions,
        clicks,
        saves,
        ctr,
        saveRate,
        revenue,
      }
    })

    const topProducts = productMetrics
      .filter((p) => p.impressions > 0)
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 10)

    // Generate demographics data (mock data)
    const demographics = {
      ageGroups: [
        { group: '18-24', percentage: 25 },
        { group: '25-34', percentage: 35 },
        { group: '35-44', percentage: 20 },
        { group: '45-54', percentage: 15 },
        { group: '55+', percentage: 5 },
      ],
      genders: [
        { gender: 'Female', percentage: 60 },
        { gender: 'Male', percentage: 35 },
        { gender: 'Other', percentage: 5 },
      ],
      locations: [
        { location: 'United States', percentage: 40 },
        { location: 'United Kingdom', percentage: 25 },
        { location: 'Canada', percentage: 15 },
        { location: 'Australia', percentage: 10 },
        { location: 'Other', percentage: 10 },
      ],
    }

    // Generate time-based analysis (mock data)
    const timeframes = {
      hourly: generateHourlyData(totalImpressions),
      daily: generateDailyData(daysBack, totalImpressions),
      weekly: generateWeeklyData(daysBack, totalImpressions),
    }

    return NextResponse.json({
      overview: {
        totalProducts: vendor.products.length,
        totalImpressions,
        totalClicks,
        totalSaves,
        totalRevenue,
        ctr,
        saveRate,
        conversionRate,
      },
      trends,
      topProducts,
      demographics,
      timeframes,
    })
  } catch (error) {
    console.error('Vendor analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}

function generateTrendData(days: number, total: number) {
  const data = []
  const dailyAverage = total / days

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const value = Math.max(
      0,
      dailyAverage + (Math.random() - 0.5) * dailyAverage * 0.5
    )
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value),
    })
  }

  return data
}

function generateHourlyData(total: number) {
  const data = []
  for (let hour = 0; hour < 24; hour++) {
    const value = Math.max(
      0,
      total / 24 + (Math.random() - 0.5) * (total / 24) * 0.3
    )
    data.push({
      hour,
      value: Math.round(value),
    })
  }
  return data
}

function generateDailyData(days: number, total: number) {
  const data = []
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    const value = Math.max(
      0,
      total / days + (Math.random() - 0.5) * (total / days) * 0.5
    )
    data.push({
      day: date.toISOString().split('T')[0],
      value: Math.round(value),
    })
  }
  return data
}

function generateWeeklyData(days: number, total: number) {
  const data = []
  const weeks = Math.ceil(days / 7)
  for (let week = weeks - 1; week >= 0; week--) {
    const date = new Date(Date.now() - week * 7 * 24 * 60 * 60 * 1000)
    const value = Math.max(
      0,
      total / weeks + (Math.random() - 0.5) * (total / weeks) * 0.3
    )
    data.push({
      week: `Week ${weeks - week}`,
      value: Math.round(value),
    })
  }
  return data
}

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

    // Get conversion data
    const conversionData = await prisma.analyticsEvent.groupBy({
      by: ['event'],
      where: {
        timestamp: { gte: startDate },
        event: 'conversion',
      },
      _count: { event: true },
      _avg: {
        // This would need additional fields in the schema
      },
    })

    // Transform data for frontend
    const conversions = conversionData.map((conversion) => ({
      type: conversion.event,
      count: conversion._count.event,
      value: 0, // Placeholder
      conversionRate: 0, // Placeholder
    }))

    return NextResponse.json(conversions)
  } catch (error) {
    console.error('Failed to get conversions:', error)
    return NextResponse.json(
      { error: 'Failed to get conversions' },
      { status: 500 }
    )
  }
}

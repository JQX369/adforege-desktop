import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const vendorId = searchParams.get('vendorId')

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID is required' },
        { status: 400 }
      )
    }

    // Check if vendor exists
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
            status: true,
            createdAt: true,
          },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    // Calculate overview stats
    const totalProducts = vendor.products.length
    const activeProducts = vendor.products.filter(
      (p) => p.status === 'APPROVED'
    ).length
    const pendingProducts = vendor.products.filter(
      (p) => p.status === 'PENDING'
    ).length

    // Get metrics from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const productIds = vendor.products.map((p) => p.id)

    const events = await prisma.recommendationEvent.groupBy({
      by: ['productId', 'action'],
      where: {
        productId: { in: productIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { _all: true },
    })

    // Calculate totals
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

    // Estimate revenue (simplified calculation)
    const totalRevenue = totalSaves * 0.1 // $0.10 per save as example

    // Generate recent activity
    const recentActivity = [
      {
        id: '1',
        type: 'Product Added',
        description: 'New product "Sample Gift" was added',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: 'success' as const,
      },
      {
        id: '2',
        type: 'Product Approved',
        description: 'Product "Holiday Special" was approved',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        status: 'success' as const,
      },
      {
        id: '3',
        type: 'Performance Alert',
        description: 'Low CTR detected on recent products',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'warning' as const,
      },
    ]

    // Calculate performance score
    let performanceScore = 0
    let performanceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' = 'beginner'
    let badges: string[] = []
    let nextMilestone = ''

    // Score based on various factors
    if (totalProducts >= 10) performanceScore += 20
    if (totalProducts >= 50) performanceScore += 20
    if (ctr >= 0.05) performanceScore += 20
    if (saveRate >= 0.1) performanceScore += 20
    if (totalRevenue >= 100) performanceScore += 20

    // Determine level and badges
    if (performanceScore >= 80) {
      performanceLevel = 'expert'
      badges = ['Expert Seller', 'High Performer', 'Revenue Leader']
      nextMilestone = 'Maintain expert status'
    } else if (performanceScore >= 60) {
      performanceLevel = 'advanced'
      badges = ['Advanced Seller', 'Good Performer']
      nextMilestone = 'Reach expert level'
    } else if (performanceScore >= 40) {
      performanceLevel = 'intermediate'
      badges = ['Intermediate Seller']
      nextMilestone = 'Improve CTR and save rate'
    } else {
      performanceLevel = 'beginner'
      badges = ['New Seller']
      nextMilestone = 'Add more products and improve quality'
    }

    // Quick actions
    const quickActions = [
      {
        id: 'add-product',
        title: 'Add New Product',
        description: 'Submit a new product for approval',
        icon: 'Plus',
        action: 'add-product',
        variant: 'default' as const,
      },
      {
        id: 'bulk-upload',
        title: 'Bulk Upload',
        description: 'Upload multiple products at once',
        icon: 'Upload',
        action: 'bulk-upload',
        variant: 'secondary' as const,
      },
      {
        id: 'view-analytics',
        title: 'View Analytics',
        description: 'Check detailed performance metrics',
        icon: 'BarChart3',
        action: 'view-analytics',
        variant: 'outline' as const,
      },
      {
        id: 'update-profile',
        title: 'Update Profile',
        description: 'Edit your vendor information',
        icon: 'User',
        action: 'update-profile',
        variant: 'outline' as const,
      },
    ]

    const response = {
      overview: {
        totalProducts,
        activeProducts,
        pendingProducts,
        totalImpressions,
        totalClicks,
        totalSaves,
        totalRevenue,
        ctr,
        saveRate,
        conversionRate,
      },
      recentActivity,
      quickActions,
      performance: {
        score: performanceScore,
        level: performanceLevel,
        badges,
        nextMilestone,
      },
      showOnboarding:
        totalProducts === 0 &&
        vendor.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Enhanced vendor dashboard error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    )
  }
}

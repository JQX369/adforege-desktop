import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface TopGuidesRequest {
  recipient?: string
  category?: string
  limit?: number
  window?: number // days
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient')
    const category = searchParams.get('category')
    const limit = Math.min(parseInt(searchParams.get('limit') || '24'), 50) // Max 50
    const windowDays = Math.min(parseInt(searchParams.get('window') || '90'), 365) // Max 1 year

    // Calculate the cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - windowDays)

    // Build the query to get saved products with counts
    const savedProducts = await prisma.swipe.groupBy({
      by: ['productId'],
      where: {
        action: 'SAVED',
        ts: {
          gte: cutoffDate
        },
        // Filter by product category if specified
        ...(category && {
          product: {
            categories: {
              has: category
            }
          }
        })
      },
      _count: {
        productId: true
      },
      orderBy: {
        _count: {
          productId: 'desc'
        }
      },
      take: limit * 2, // Get more to allow for filtering
    })

    if (savedProducts.length === 0) {
      return NextResponse.json({
        products: [],
        count: 0,
        lastUpdated: new Date().toISOString(),
        window: windowDays
      })
    }

    // Get the actual product data
    const productIds = savedProducts.map(s => s.productId)
    const products = await prisma.product.findMany({
      where: {
        id: {
          in: productIds
        },
        status: 'APPROVED',
        available: true
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        images: true,
        categories: true,
        affiliateUrl: true,
        brand: true,
        rating: true,
        numReviews: true,
        currency: true,
        updatedAt: true
      }
    })

    // Combine with save counts and apply time decay
    const now = new Date()
    const productsWithScores = products.map(product => {
      const saveData = savedProducts.find(s => s.productId === product.id)
      const saveCount = saveData?._count.productId || 0

      // Apply time decay: more recent saves have higher weight
      // Simple decay formula: score = saveCount * (1 / (1 + daysSinceLastSave))
      const daysSinceUpdate = Math.max(1, (now.getTime() - product.updatedAt.getTime()) / (1000 * 60 * 60 * 24))
      const decayedScore = saveCount * (1 / (1 + Math.log(daysSinceUpdate)))

      return {
        ...product,
        saveCount,
        score: decayedScore,
        lastUpdated: product.updatedAt.toISOString()
      }
    })

    // Sort by decayed score and take top results
    const topProducts = productsWithScores
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...product }) => product) // Remove score from response

    return NextResponse.json({
      products: topProducts,
      count: topProducts.length,
      lastUpdated: now.toISOString(),
      window: windowDays,
      filters: {
        recipient,
        category
      }
    })

  } catch (error) {
    console.error('Error fetching top saved products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch top products' },
      { status: 500 }
    )
  }
}

// Cache for 15 minutes
export const revalidate = 900 // 15 minutes in seconds

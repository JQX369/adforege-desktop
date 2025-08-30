import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Remove edge runtime - Prisma doesn't support it
// export const runtime = 'edge'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId

    // Get all saved products for the user
    const savedSwipes = await prisma.swipe.findMany({
      where: {
        userId,
        action: 'SAVED'
      },
      include: {
        product: true
      },
      orderBy: {
        ts: 'desc'
      }
    })

    const products = savedSwipes.map((swipe: any) => ({
      ...swipe.product,
      savedAt: swipe.ts.toISOString()
    }))

    return NextResponse.json({
      products,
      count: products.length
    })
  } catch (error) {
    console.error('Error fetching saved products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved products' },
      { status: 500 }
    )
  }
} 
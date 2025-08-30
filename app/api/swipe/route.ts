import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Remove edge runtime - Prisma doesn't support it
// export const runtime = 'edge'

interface SwipeRequest {
  userId: string
  productId: string
  action: 'LEFT' | 'RIGHT' | 'SAVED'
  sessionId: string
  product?: {
    title?: string
    description?: string
    price?: number
    imageUrl?: string
    affiliateUrl?: string
    categories?: string[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, productId, action, sessionId, product: incoming } = body as SwipeRequest

    // Validate input
    if (!userId || !productId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create or get user (offline tolerant)
    let user: any = { id: userId, embedding: [] }
    try {
      user = await prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          email: `${userId}@anonymous.user`,
        },
        update: {},
      })
    } catch (e) {
      console.log('Swipe API: DB unavailable, proceeding in demo mode')
    }

    // Check if product exists in database; if not and incoming provided, persist minimal product
    let existingProduct: any = null
    try {
      existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      })
    } catch {}

    // Persist ephemeral search result as Product for saving/swiping
    if (!existingProduct && incoming && incoming.affiliateUrl) {
      try {
        const url = new URL(incoming.affiliateUrl)
        // Try find by affiliateUrl if present in DB
        const found = await prisma.product.findFirst({ where: { affiliateUrl: url.toString() } })
        if (found) {
          existingProduct = found
        } else {
          const created = await prisma.product.create({
            data: {
              title: incoming.title || 'Gift',
              description: incoming.description || '',
              price: typeof incoming.price === 'number' ? incoming.price : 0,
              images: incoming.imageUrl ? [incoming.imageUrl] : [],
              affiliateUrl: url.toString(),
              categories: Array.isArray(incoming.categories) ? incoming.categories : [],
              embedding: [],
              status: 'APPROVED',
            },
            select: { id: true },
          })
          existingProduct = { id: created.id }
        }
      } catch (e) {
        // Non-blocking
      }
    }

    // Only record swipe if product exists in database
    let swipe: { id: string } | null = null
    if (existingProduct) {
      try {
        swipe = await prisma.swipe.create({
          data: {
            userId: user.id,
            productId: existingProduct.id || productId,
            action,
          },
        })
      } catch {}
    }

    // Update user embedding based on swipe (if RIGHT or SAVED)
    if (action === 'RIGHT' || action === 'SAVED') {
      // Get product embedding
      let product: any = null
      try {
        product = await prisma.product.findUnique({
          where: { id: productId },
          select: { embedding: true },
        })
      } catch {}

      if (product && product.embedding) {
        // Update user embedding with weighted average
        // Formula: newEmbedding = 0.8 * oldEmbedding + 0.2 * productEmbedding
        
        if (user.embedding && user.embedding.length > 0) {
          // User has existing embedding
          const newEmbedding = user.embedding.map((val: number, idx: number) => 
            0.8 * val + 0.2 * product.embedding[idx]
          )
          
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { embedding: newEmbedding },
            })
          } catch {}
        } else {
          // First swipe - use product embedding directly
          try {
            await prisma.user.update({
              where: { id: userId },
              data: { embedding: product.embedding },
            })
          } catch {}
        }
      }
    }

    // Get saved count for the user
    let savedCount = 0
    try {
      savedCount = await prisma.swipe.count({
        where: {
          userId: user.id,
          action: 'SAVED',
        },
      })
    } catch {}

    return NextResponse.json({
      success: true,
      swipeId: swipe ? swipe.id : null,
      savedCount,
      message: action === 'SAVED' ? 'Product saved to your list!' : 'Swipe recorded',
    })
  } catch (error) {
    console.error('Error in swipe API:', error)
    // Demo mode fallback: do not block UI
    return NextResponse.json({ success: true, swipeId: null, savedCount: 0, message: 'Recorded (demo mode)' })
  }
} 
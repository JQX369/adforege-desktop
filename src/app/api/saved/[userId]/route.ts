import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
        action: 'SAVED',
      },
      include: {
        product: true,
      },
      orderBy: {
        ts: 'desc',
      },
    })

    const products = savedSwipes.map((swipe: any) => ({
      ...swipe.product,
      savedAt: swipe.ts.toISOString(),
    }))

    return NextResponse.json({
      products,
      count: products.length,
    })
  } catch (error) {
    console.error('Error fetching saved products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch saved products' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = params.userId
    const body = await request.json().catch(() => null)
    const productId = body?.productId as string | undefined

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 })
    }

    const result = await prisma.swipe.deleteMany({
      where: {
        userId,
        productId,
        action: 'SAVED',
      },
    })

    return NextResponse.json({ success: true, deleted: result.count })
  } catch (error) {
    console.error('Error deleting saved product:', error)
    return NextResponse.json(
      { error: 'Failed to delete saved product' },
      { status: 500 }
    )
  }
}

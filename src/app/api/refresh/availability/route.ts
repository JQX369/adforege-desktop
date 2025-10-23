import { NextRequest, NextResponse } from 'next/server'
import { AvailabilityStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertAdmin, AdminAuthError } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    await assertAdmin(req)

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId') || undefined

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 })
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        lastCheckedAt: new Date(),
        availability: AvailabilityStatus.UNKNOWN,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    console.error('refresh availability error:', error)
    return NextResponse.json(
      { error: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

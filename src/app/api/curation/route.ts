import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertAdmin } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  try {
    await assertAdmin(req)

    const searchParams = req.nextUrl.searchParams
    const limit = Number(searchParams.get('limit') || 25)
    const productId = searchParams.get('productId') || undefined

    const boosts = await prisma.curatedBoost.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit > 0 ? limit : 25,
      where: productId ? { productId } : undefined,
      include: {
        product: {
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

    return NextResponse.json({ boosts })
  } catch (error: any) {
    console.error('[curation][GET] failed', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch boosts' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await assertAdmin(req)

    const body = await req.json()
    const {
      productId,
      profileTag,
      characterId,
      weight = 1,
      startAt,
      endAt,
      notes,
    } = body || {}

    if (!productId) {
      return NextResponse.json({ error: 'productId required' }, { status: 400 })
    }

    const productExists = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    })
    if (!productExists) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const created = await prisma.curatedBoost.create({
      data: {
        productId,
        profileTag,
        characterId,
        weight,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        createdBy: user.email ?? user.id,
        notes,
      },
      include: {
        product: {
          select: { id: true, title: true },
        },
      },
    })

    return NextResponse.json({ boost: created })
  } catch (error: any) {
    console.error('[curation][POST] failed', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to create boost' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await assertAdmin(req)

    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter required' },
        { status: 400 }
      )
    }

    await prisma.curatedBoost.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[curation][DELETE] failed', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to delete boost' },
      { status: 500 }
    )
  }
}

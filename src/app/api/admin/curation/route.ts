import { NextRequest, NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'

import { createSupabaseServerClient } from '@/lib/supabase-server'

const prisma = new PrismaClient()

function isAdmin(email: string | null | undefined) {
  const admins = (process.env.INGEST_ADMINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!admins.length) return false
  return email ? admins.includes(email) : false
}

async function ensureAdmin(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return user
}

export async function GET(req: NextRequest) {
  const user = await ensureAdmin(req)
  if (user instanceof NextResponse) return user

  const searchParams = req.nextUrl.searchParams
  const limit = Number(searchParams.get('limit') || 25)
  const productId = searchParams.get('productId') || undefined

  const boosts = await prisma.$queryRaw<Array<any>>`
    SELECT * FROM "curated_boosts" LIMIT ${limit > 0 ? limit : 25}
  `.catch(() => [])
  
  // TODO: Add CuratedBoost model to Prisma schema
  // const boosts = await prisma.curatedBoost.findMany({
  //   orderBy: { createdAt: 'desc' },
  //   take: limit > 0 ? limit : 25,
  //   where: productId ? { productId } : undefined,
  //   include: {
  //     product: {
  //       select: {
  //         id: true,
  //         title: true,
  //         images: true,
  //         price: true,
  //         currency: true,
  //       },
  //     },
  //   },
  // })

  return NextResponse.json({ boosts })
}

export async function POST(req: NextRequest) {
  const user = await ensureAdmin(req)
  if (user instanceof NextResponse) return user

  try {
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

    // TODO: Add CuratedBoost model to Prisma schema
    // const created = await prisma.curatedBoost.create({
    //   data: {
    //     productId,
    //     profileTag,
    //     characterId,
    //     weight,
    //     startAt: startAt ? new Date(startAt) : null,
    //     endAt: endAt ? new Date(endAt) : null,
    //     createdBy: user.email ?? user.id,
    //     notes,
    //   },
    //   include: {
    //     product: {
    //       select: { id: true, title: true },
    //     },
    //   },
    // })
    
    const created = { id: 'temp', productId, profileTag, characterId, weight }
    
    return NextResponse.json({ boost: created })
  } catch (error) {
    console.error('[curation][POST] failed', error)
    return NextResponse.json(
      { error: 'Failed to create boost' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  const user = await ensureAdmin(req)
  if (user instanceof NextResponse) return user

  try {
    const searchParams = req.nextUrl.searchParams
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter required' },
        { status: 400 }
      )
    }

    // TODO: Add CuratedBoost model to Prisma schema
    // await prisma.curatedBoost.delete({ where: { id } })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[curation][DELETE] failed', error)
    return NextResponse.json(
      { error: 'Failed to delete boost' },
      { status: 500 }
    )
  }
}

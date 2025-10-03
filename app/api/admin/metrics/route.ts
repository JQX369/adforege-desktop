import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!user || (admins.length > 0 && !admins.includes(user.email || ''))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const windowDays = Number(process.env.DASHBOARD_WINDOW_DAYS || 7)
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

    const actionGroups = await prisma.recommendationEvent.groupBy({
      by: ['action'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    })

    const actionCounts = actionGroups.reduce<Record<string, number>>((acc, group) => {
      acc[group.action] = group._count._all
      return acc
    }, {})

    const impressions = actionCounts.IMPRESSION || 0
    const clicks = actionCounts.CLICK || 0
    const saves = actionCounts.SAVE || 0
    const likes = actionCounts.LIKE || 0
    const dislikes = actionCounts.DISLIKE || 0
    const rerolls = actionCounts.REROLL || 0

    const productUsage = await prisma.recommendationEvent.groupBy({
      by: ['productId'],
      where: {
        createdAt: { gte: since },
        productId: { not: null },
      },
      _count: { _all: true },
      orderBy: [
        {
          _count: {
            productId: 'desc',
          },
        },
      ],
      take: 50,
    })

    const activeProductIds = productUsage
      .map((item) => item.productId)
      .filter((id): id is string => Boolean(id))

    const productDetails = await prisma.product.findMany({
      where: { id: { in: activeProductIds } },
      select: {
        id: true,
        title: true,
        images: true,
        vendorEmail: true,
        vendor: {
          select: {
            plan: true,
            email: true,
          },
        },
        categories: true,
      },
    })

    const productMap = new Map(productDetails.map((p) => [p.id, p]))

    const perProductAction = await prisma.recommendationEvent.groupBy({
      by: ['productId', 'action'],
      where: {
        productId: { in: activeProductIds },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    })

    const productActionMap = new Map<string, Record<string, number>>()
    for (const group of perProductAction) {
      if (!group.productId) continue
      const current = productActionMap.get(group.productId) || {}
      current[group.action] = group._count._all
      productActionMap.set(group.productId, current)
    }

    const topProducts = productUsage
      .slice(0, 5)
      .map((item) => {
        if (!item.productId) return null
        const details = productMap.get(item.productId)
        if (!details) return null
        const actions = productActionMap.get(item.productId) || {}
        return {
          id: item.productId,
          title: details.title,
          imageUrl: details.images?.[0] || '',
          vendor: details.vendorEmail || 'affiliate',
          vendorPlan: details.vendor?.plan || null,
          impressions: actions.IMPRESSION || 0,
          clicks: actions.CLICK || 0,
          saves: actions.SAVE || 0,
        }
      })
      .filter(Boolean)

    const vendorCounts = new Map<string, number>()
    for (const usage of productUsage) {
      if (!usage.productId) continue
      const product = productMap.get(usage.productId)
      if (!product || !product.vendorEmail) continue
      vendorCounts.set(product.vendorEmail, (vendorCounts.get(product.vendorEmail) || 0) + usage._count._all)
    }

    const vendorMix = Array.from(vendorCounts.entries())
      .map(([vendorEmail, events]) => {
        const product = productDetails.find((p) => p.vendorEmail === vendorEmail)
        return {
          vendorEmail,
          plan: product?.vendor?.plan || null,
          events,
        }
      })
      .sort((a, b) => b.events - a.events)
      .slice(0, 5)

    const tagCounts = activeProductIds.length
      ? await prisma.productTag.groupBy({
          by: ['tag'],
          where: { productId: { in: activeProductIds } },
          _count: { _all: true },
          orderBy: [
            {
              _count: {
                tag: 'desc',
              },
            },
          ],
          take: 10,
        })
      : []

    const categoryCounts: Record<string, number> = {}
    for (const product of productDetails) {
      if (!activeProductIds.includes(product.id)) continue
      for (const category of product.categories || []) {
        const key = category.toLowerCase()
        categoryCounts[key] = (categoryCounts[key] || 0) + 1
      }
    }
    const categoryMix = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }))

    const approvedProducts = await prisma.product.count({ where: { status: 'APPROVED' } })

    const totals = { impressions, clicks, saves, likes, dislikes, rerolls }
    const rates = {
      ctr: impressions > 0 ? clicks / impressions : 0,
      saveRate: impressions > 0 ? saves / impressions : 0,
      engagementRate: impressions > 0 ? (clicks + saves + likes) / impressions : 0,
    }

    return NextResponse.json({
      windowDays,
      totals,
      rates,
      topProducts,
      topTags: tagCounts.map((tag) => ({ tag: tag.tag, count: tag._count._all })),
      vendorMix,
      categoryMix,
      approvedProducts,
    })
  } catch (e: any) {
    console.error('metrics error:', e)
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}



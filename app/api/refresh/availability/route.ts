import { NextRequest, NextResponse } from 'next/server'

import { PrismaClient } from '@prisma/client'

import { RainforestProvider } from '@/lib/providers/rainforest-enhanced'
import { EbayProvider } from '@/lib/providers/ebay-enhanced'

const prisma = new PrismaClient()

const rainforestApiKey = process.env.RAINFOREST_API_KEY || ''
const ebayClientId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID || ''
const ebayOAuthToken = process.env.EBAY_OAUTH_TOKEN || ''
const ebayCampaignId = process.env.EBAY_CAMPAIGN_ID || ''

const rainforestProvider = rainforestApiKey ? new RainforestProvider(rainforestApiKey) : null
const ebayProvider = ebayClientId && ebayOAuthToken ? new EbayProvider(ebayClientId, ebayOAuthToken, ebayCampaignId) : null

const MAX_BATCH = 20

async function refreshRainforestProducts(products: { id: string; asin: string | null }[]) {
  if (!rainforestProvider) return

  for (const product of products) {
    if (!product.asin) continue

    try {
      const details = await rainforestProvider.getProductDetails(product.asin)
      if (!details) continue

      await prisma.product.update({
        where: { id: product.id },
        data: {
          price: details.price,
          currency: details.currency,
          availability: details.availability,
          inStock: details.inStock,
          available: details.inStock,
          stockQuantity: details.stockQuantity,
          deliveryDays: details.deliveryDays,
          deliveryMin: details.deliveryMin,
          deliveryMax: details.deliveryMax,
          lastCheckedAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
    } catch (error) {
      console.log('[refresh][rainforest] failed', product.id, error)
    }
  }
}

async function refreshEbayProducts(products: { id: string; sourceItemId: string | null }[]) {
  if (!ebayProvider) return

  for (const product of products) {
    if (!product.sourceItemId) continue

    try {
      const details = await ebayProvider.getProductDetails(product.sourceItemId)
      if (!details) continue

      await prisma.product.update({
        where: { id: product.id },
        data: {
          price: details.price,
          currency: details.currency,
          availability: details.availability,
          inStock: details.inStock,
          available: details.inStock,
          stockQuantity: details.stockQuantity,
          deliveryDays: details.deliveryDays,
          deliveryMin: details.deliveryMin,
          deliveryMax: details.deliveryMax,
          expiresAt: details.expiresAt || null,
          lastCheckedAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
    } catch (error) {
      console.log('[refresh][ebay] failed', product.id, error)
    }
  }
}

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const provider = params.get('provider') || 'all'
    const limitParam = Number(params.get('limit') || MAX_BATCH)
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_BATCH) : MAX_BATCH

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const rainforestProducts = provider === 'all' || provider === 'rainforest'
      ? await prisma.product.findMany({
          where: {
            source: 'AFFILIATE',
            asin: { not: null },
            lastCheckedAt: { lt: twentyFourHoursAgo },
          },
          select: { id: true, asin: true },
          take: limit,
        })
      : []

    const ebayProducts = provider === 'all' || provider === 'ebay'
      ? await prisma.product.findMany({
          where: {
            source: 'AFFILIATE',
            sourceItemId: { not: null },
            lastCheckedAt: { lt: twentyFourHoursAgo },
          },
          select: { id: true, sourceItemId: true },
          take: limit,
        })
      : []

    await Promise.all([
      refreshRainforestProducts(rainforestProducts),
      refreshEbayProducts(ebayProducts),
    ])

    return NextResponse.json({
      refreshed: {
        rainforest: rainforestProducts.length,
        ebay: ebayProducts.length,
      },
    })
  } catch (error) {
    console.error('[refresh][availability] failed', error)
    return NextResponse.json({ error: 'Failed to refresh availability' }, { status: 500 })
  }
}



import { NextRequest, NextResponse } from 'next/server'
import {
  PrismaClient,
  ProductSource,
  AvailabilityStatus,
  ProductStatus,
} from '@prisma/client'
import OpenAI from 'openai'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'

export const runtime = 'nodejs'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('Authorization')
    const isCron = auth === `Bearer ${process.env.CRON_SECRET}`
    if (!isCron)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { startUrls = [] } = (await req
      .json()
      .catch(() => ({ startUrls: [] }))) as { startUrls: string[] }
    const apifyToken = process.env.APIFY_TOKEN || ''
    if (!apifyToken)
      return NextResponse.json(
        { error: 'Missing APIFY_TOKEN' },
        { status: 500 }
      )

    // Use a generic crawler actor that extracts product anchors from eBay category pages
    const input = {
      startUrls: startUrls.map((url) => ({ url })),
      linkSelector: 'a.s-item__link',
      maxDepth: 1,
      maxRequestsPerCrawl: 200,
    }
    const runRes = await fetch(
      'https://api.apify.com/v2/acts/apify~web-scraper/runs?wait=1',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apifyToken}`,
        },
        body: JSON.stringify({ input }),
      }
    )
    const run = await runRes.json()
    const datasetId = run?.data?.defaultDatasetId
    if (!datasetId)
      return NextResponse.json({ error: 'Apify run failed' }, { status: 500 })

    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items`
    )
    const items = await itemsRes.json()
    const urls: string[] = Array.from(
      new Set((items || []).map((i: any) => i?.url).filter(Boolean))
    )

    let created = 0,
      updated = 0
    for (const url of urls) {
      const cleaned = cleanProductUrl(url)
      const title =
        cleaned.split('/').slice(-1)[0]?.replace(/[-_]/g, ' ') || 'eBay Product'
      const affiliateUrl = buildAffiliateUrl(cleaned)

      let embedding: number[] = []
      try {
        const er = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: title,
        })
        embedding = er.data[0].embedding
      } catch {}

      const qualityScore =
        (affiliateUrl && affiliateUrl !== '#' ? 0.5 : 0) +
        (embedding.length ? 0.5 : 0)
      const status =
        qualityScore >= 0.75 ? ProductStatus.APPROVED : ProductStatus.PENDING
      const domain = new URL(cleaned).hostname.replace(/^www\./, '')
      let merchant = await prisma.merchant.findUnique({ where: { domain } })
      if (!merchant)
        merchant = await prisma.merchant.create({
          data: { name: 'eBay', domain },
        })

      const existing = await prisma.product.findFirst({
        where: { urlCanonical: cleaned },
      })
      const dataUp = {
        title,
        description: '',
        price: 0,
        images: [] as string[],
        affiliateUrl,
        categories: [] as string[],
        embedding,
        status,
        source: ProductSource.AFFILIATE,
        retailer: 'ebay',
        currency: 'USD',
        availability: AvailabilityStatus.UNKNOWN,
        brand: null as string | null,
        asin: null as string | null,
        merchantId: merchant.id,
        affiliateProgram: 'ebay',
        urlCanonical: cleaned,
        qualityScore,
        lastSeenAt: new Date(),
        rating: null as number | null,
        numReviews: null as number | null,
      }
      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: dataUp,
        })
        updated++
      } else {
        await prisma.product.create({ data: dataUp })
        created++
      }
    }

    return NextResponse.json({ ok: true, created, updated })
  } catch (e: any) {
    console.error('Apify eBay error:', e)
    return NextResponse.json(
      { error: e?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

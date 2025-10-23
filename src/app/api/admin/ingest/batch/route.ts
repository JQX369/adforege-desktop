import { NextRequest, NextResponse } from 'next/server'
import {
  ProductStatus,
  ProductSource,
  AvailabilityStatus,
} from '@prisma/client'
import OpenAI from 'openai'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'
import { rateLimit } from '@/lib/utils'
import { prisma } from '@/lib/prisma'
import { logError, logInfo } from '@/lib/log'
import { assertAdmin } from '@/lib/admin-auth'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export const runtime = 'nodejs'

type IngestItem = {
  title: string
  description: string
  price: number
  imageUrl: string
  url: string
  categories?: string[]
  brand?: string
  retailer?: string
  currency?: string
  asin?: string
  merchantDomain?: string
  affiliateProgram?: string
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anon'
    if (!rateLimit(`ingest:${ip}`, 60)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }
    await assertAdmin(req)

    const body = await req.json()
    const items: IngestItem[] = Array.isArray(body?.items) ? body.items : []
    if (!items.length)
      return NextResponse.json({ error: 'No items' }, { status: 400 })

    const created: string[] = []
    const updated: string[] = []
    const rejected: Array<{ url: string; reason: string }> = []

    for (const raw of items) {
      try {
        // Basic validation
        if (
          !raw.title ||
          !raw.description ||
          !raw.price ||
          !raw.url ||
          !raw.imageUrl
        ) {
          rejected.push({ url: raw.url, reason: 'Missing required fields' })
          continue
        }

        const urlCanonical = cleanProductUrl(raw.url)
        const affiliateUrl = buildAffiliateUrl(raw.url)
        const categories = Array.isArray(raw.categories) ? raw.categories : []

        // Build embedding text
        const embeddingText = `${raw.title}. ${raw.description}`.slice(0, 1500)
        let embedding: number[] = []
        try {
          const embeddingResp = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: embeddingText,
          })
          embedding = embeddingResp.data[0].embedding
        } catch {
          embedding = []
        }

        const qualityScore =
          (raw.price > 0 ? 0.2 : 0) +
          (raw.imageUrl ? 0.2 : 0) +
          (affiliateUrl && affiliateUrl !== '#' ? 0.2 : 0) +
          (categories.length ? 0.2 : 0) +
          (embedding.length ? 0.2 : 0)

        // Ensure Merchant
        let merchantId: string | undefined
        const domain = (
          raw.merchantDomain || new URL(urlCanonical).hostname
        ).replace(/^www\./, '')
        let merchant = await prisma.merchant.findUnique({ where: { domain } })
        if (!merchant) {
          merchant = await prisma.merchant.create({
            data: {
              name: raw.retailer || domain,
              domain,
              affiliateProgram: raw.affiliateProgram || null,
            },
          })
        }
        merchantId = merchant.id

        // Upsert Product by canonical URL or ASIN
        let existing = await prisma.product.findFirst({
          where: { OR: [{ urlCanonical }, { asin: raw.asin || '' }] },
        })

        const data = {
          title: raw.title,
          description: raw.description,
          price: Number(raw.price),
          images: [raw.imageUrl],
          affiliateUrl,
          categories,
          embedding,
          status: ProductStatus.APPROVED,
          source: ProductSource.AFFILIATE,
          retailer: raw.retailer || domain,
          currency: raw.currency || 'USD',
          availability: AvailabilityStatus.IN_STOCK,
          brand: raw.brand || null,
          asin: raw.asin || null,
          merchantId,
          affiliateProgram: raw.affiliateProgram || null,
          urlCanonical,
          qualityScore,
          lastSeenAt: new Date(),
        }

        if (existing) {
          await prisma.product.update({ where: { id: existing.id }, data })
          updated.push(existing.id)
        } else {
          const createdRec = await prisma.product.create({ data })
          created.push(createdRec.id)
        }
      } catch (e: any) {
        rejected.push({ url: raw.url, reason: e?.message || 'Unknown error' })
      }
    }

    return NextResponse.json({
      success: true,
      createdCount: created.length,
      updatedCount: updated.length,
      rejected,
      createdIds: created,
      updatedIds: updated,
    })
  } catch (err: any) {
    logError('Batch ingest error', { error: err })
    return NextResponse.json(
      { error: err?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}

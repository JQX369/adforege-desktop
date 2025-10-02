import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, ProductStatus, ProductSource, AvailabilityStatus } from '@prisma/client'
import OpenAI from 'openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'
import { rateLimit } from '@/lib/utils'

export const runtime = 'nodejs'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

function absoluteUrl(base: string, maybeRelative?: string): string | undefined {
  if (!maybeRelative) return undefined
  try {
    return new URL(maybeRelative, base).toString()
  } catch {
    return undefined
  }
}

function extractMeta(html: string, baseUrl: string) {
  const get = (re: RegExp) => {
    const m = html.match(re)
    return m?.[1]?.trim()
  }
  const title = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/<title[^>]*>([^<]+)<\/title>/i)
  const description = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  const ogImg = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  const img = absoluteUrl(baseUrl, ogImg)
  const priceStr = get(/<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/itemprop=["']price["'][^>]*content=["']([^"']+)["'][^>]*>/i)
    || get(/\bdata-price=["']([^"']+)["']/i)
  const currency = get(/<meta[^>]+property=["']product:price:currency["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || get(/itemprop=["']priceCurrency["'][^>]*content=["']([^"']+)["'][^>]*>/i)
  let price = 0
  if (priceStr) {
    const n = Number(String(priceStr).replace(/[^0-9.]/g, ''))
    price = isFinite(n) ? n : 0
  }
  return { title, description, img, price, currency }
}

async function ingestOne(url: string) {
  const cleaned = cleanProductUrl(url)
  const u = new URL(cleaned)
  const domain = u.hostname.replace(/^www\./, '')
  const retailer = domain
  const res = await fetch(cleaned, { redirect: 'follow' })
  const html = await res.text()
  const meta = extractMeta(html, cleaned)

  const title = meta.title || retailer
  const description = meta.description || 'Imported product'
  const imageUrl = meta.img
  const price = meta.price || 0
  const currency = meta.currency || undefined
  const affiliateUrl = buildAffiliateUrl(cleaned)

  // embedding
  let embedding: number[] = []
  try {
    const text = `${title}. ${description}`.slice(0, 1500)
    const er = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
    embedding = er.data[0].embedding
  } catch {}

  // quality heuristic
  const qualityScore = (
    (price > 0 ? 0.25 : 0) +
    (imageUrl ? 0.25 : 0) +
    (affiliateUrl && affiliateUrl !== '#' ? 0.25 : 0) +
    (embedding.length ? 0.25 : 0)
  )
  const status = qualityScore >= 0.75 ? ProductStatus.APPROVED : ProductStatus.PENDING

  // Merchant
  let merchant = await prisma.merchant.findUnique({ where: { domain } })
  if (!merchant) {
    merchant = await prisma.merchant.create({ data: { name: retailer, domain } })
  }

  // Upsert by canonical URL
  const existing = await prisma.product.findFirst({ where: { urlCanonical: cleaned } })
  const data = {
    title,
    description,
    price,
    images: imageUrl ? [imageUrl] : [],
    affiliateUrl,
    categories: [] as string[],
    embedding,
    status,
    source: ProductSource.AFFILIATE,
    retailer,
    currency,
    availability: AvailabilityStatus.UNKNOWN,
    brand: null as string | null,
    asin: null as string | null,
    merchantId: merchant.id,
    affiliateProgram: null as string | null,
    urlCanonical: cleaned,
    qualityScore,
    lastSeenAt: new Date(),
  }

  if (existing) {
    await prisma.product.update({ where: { id: existing.id }, data })
    return { id: existing.id, updated: true }
  }
  const created = await prisma.product.create({ data })
  return { id: created.id, updated: false }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anon'
    if (!rateLimit(`ingest:${ip}`, 60)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!user || (admins.length > 0 && !admins.includes(user.email || ''))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : []
    if (!urls.length) return NextResponse.json({ error: 'No urls provided' }, { status: 400 })

    const results: any[] = []
    for (const url of urls) {
      try {
        const r = await ingestOne(url)
        results.push({ url, ...r })
      } catch (e: any) {
        results.push({ url, error: e?.message || 'Failed' })
      }
    }

    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    console.error('URL ingest POST error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'anon'
    if (!rateLimit(`ingest:${ip}`, 60)) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 })
    }
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    const admins = (process.env.INGEST_ADMINS || '').split(',').map(s => s.trim()).filter(Boolean)
    if (!user || (admins.length > 0 && !admins.includes(user.email || ''))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })
    const r = await ingestOne(url)
    const origin = new URL(req.url).origin
    return NextResponse.redirect(`${origin}/vendor/dashboard?ingested=1`, { status: 302 })
  } catch (err: any) {
    console.error('URL ingest GET error:', err)
    return NextResponse.json({ error: err?.message || 'Unknown error' }, { status: 500 })
  }
}



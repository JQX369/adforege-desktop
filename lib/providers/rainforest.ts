import { PrismaClient, ProductSource, AvailabilityStatus, ProductStatus } from '@prisma/client'
import { buildAffiliateUrl, cleanProductUrl, isAmazonUrl } from '@/lib/affiliates'
import OpenAI from 'openai'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

type RainforestProduct = {
  asin?: string
  title?: string
  link?: string
  image?: string
  prices?: { raw?: string, symbol?: string, value?: number }[]
  rating?: number
  ratings_total?: number
  categories?: { name: string }[]
}

async function fetchRainforest(params: Record<string, string>) {
  const apiKey = process.env.RAINFOREST_API_KEY || ''
  if (!apiKey) throw new Error('Missing RAINFOREST_API_KEY')
  const qp = new URLSearchParams({ api_key: apiKey, type: 'search', ...params })
  const url = `https://api.rainforestapi.com/request?${qp.toString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Rainforest error ${res.status}`)
  return res.json()
}

function parsePrice(p?: { raw?: string, value?: number }): { price: number, currency?: string } {
  if (!p) return { price: 0 }
  const price = typeof p.value === 'number' ? p.value : 0
  const currency = (p.raw || '').trim().startsWith('$') ? 'USD' : undefined
  return { price, currency }
}

export async function syncRainforestByKeyword(keyword: string, country: string = 'US') {
  const data = await fetchRainforest({ amazon_domain: country.toUpperCase() === 'US' ? 'amazon.com' : `amazon.${country.toLowerCase()}`, search_term: keyword, page: '1' })
  const items: RainforestProduct[] = data?.search_results || []
  let created = 0, updated = 0
  for (const it of items) {
    const title = it.title || ''
    const url = it.link || ''
    if (!title || !url || !isAmazonUrl(url)) continue
    const cleaned = cleanProductUrl(url)
    const { price, currency } = parsePrice(it.prices?.[0])
    const imageUrl = it.image || ''
    const categories = (it.categories || []).map(c => c.name).filter(Boolean)
    const affiliateUrl = buildAffiliateUrl(cleaned)

    // embedding
    let embedding: number[] = []
    try {
      const text = `${title}`.slice(0, 1500)
      const er = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
      embedding = er.data[0].embedding
    } catch {}

    const qualityScore = (
      (price > 0 ? 0.25 : 0) +
      (imageUrl ? 0.25 : 0) +
      (affiliateUrl && affiliateUrl !== '#' ? 0.25 : 0) +
      (embedding.length ? 0.25 : 0)
    )
    const status = qualityScore >= 0.75 ? ProductStatus.APPROVED : ProductStatus.PENDING

    // Merchant
    const domain = new URL(cleaned).hostname.replace(/^www\./, '')
    let merchant = await prisma.merchant.findUnique({ where: { domain } })
    if (!merchant) merchant = await prisma.merchant.create({ data: { name: domain, domain } })

    const existing = await prisma.product.findFirst({ where: { OR: [{ urlCanonical: cleaned }, { asin: it.asin || '' }] } })
    const dataUp = {
      title,
      description: '',
      price,
      images: imageUrl ? [imageUrl] : [],
      affiliateUrl,
      categories,
      embedding,
      status,
      source: ProductSource.AFFILIATE,
      retailer: domain,
      currency: currency || 'USD',
      availability: AvailabilityStatus.UNKNOWN,
      brand: null as string | null,
      asin: it.asin || null,
      merchantId: merchant.id,
      affiliateProgram: 'amazon',
      urlCanonical: cleaned,
      qualityScore,
      lastSeenAt: new Date(),
      rating: typeof it.rating === 'number' ? it.rating : null,
      numReviews: typeof it.ratings_total === 'number' ? it.ratings_total : null,
    }
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: dataUp })
      updated++
    } else {
      await prisma.product.create({ data: dataUp })
      created++
    }
  }
  return { created, updated }
}



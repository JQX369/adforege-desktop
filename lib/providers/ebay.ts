import { PrismaClient, ProductSource, AvailabilityStatus, ProductStatus } from '@prisma/client'
import OpenAI from 'openai'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'

const prisma = new PrismaClient()
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

type EbayItem = {
  itemId?: string
  title?: string
  price?: { value?: string, currency?: string }
  image?: { imageUrl?: string }
  itemWebUrl?: string
  categories?: { categoryId?: string, categoryName?: string }[]
}

async function ebayFetch(endpoint: string, params: Record<string, string>) {
  const appId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID || ''
  if (!appId) throw new Error('Missing EBAY_APP_ID / EBAY_CLIENT_ID')
  const qs = new URLSearchParams(params).toString()
  const url = `https://api.ebay.com/buy/browse/v1${endpoint}?${qs}`
  const res = await fetch(url, { headers: { 'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=94016', 'Authorization': `Bearer ${process.env.EBAY_OAUTH_TOKEN || ''}` } })
  if (!res.ok) throw new Error(`eBay error ${res.status}`)
  return res.json()
}

export async function syncEbayByKeyword(keyword: string) {
  const data = await ebayFetch('/item_summary/search', { q: keyword, limit: '20' })
  const items: EbayItem[] = data?.itemSummaries || []
  let created = 0, updated = 0
  for (const it of items) {
    const title = it.title || ''
    const url = it.itemWebUrl || ''
    if (!title || !url) continue
    const cleaned = cleanProductUrl(url)
    const price = Number(it.price?.value || '0')
    const currency = it.price?.currency || 'USD'
    const imageUrl = it.image?.imageUrl || ''
    const categories = (it.categories || []).map(c => c.categoryName || '').filter(Boolean)
    const affiliateUrl = buildAffiliateUrl(cleaned)

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
    if (!merchant) merchant = await prisma.merchant.create({ data: { name: 'eBay', domain } })

    const existing = await prisma.product.findFirst({ where: { urlCanonical: cleaned } })
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
      retailer: 'ebay',
      currency,
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
      await prisma.product.update({ where: { id: existing.id }, data: dataUp })
      updated++
    } else {
      await prisma.product.create({ data: dataUp })
      created++
    }
  }
  return { created, updated }
}



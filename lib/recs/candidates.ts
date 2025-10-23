import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CandidateProduct, SessionProfile } from './types'

const VECTOR_FALLBACK_LIMIT = 20

const SELECT_FIELDS = Prisma.sql`
  id,
  title,
  description,
  price,
  currency,
  images,
  "affiliateUrl",
  categories,
  retailer,
  source,
  availability,
  "vendorEmail",
  "regionMask",
  "primeEligible",
  "freeShipping",
  "deliveryDays",
  "sellerName",
  "sellerRating",
  "bestSeller",
  "marketplaceId",
  "listingType",
  "qualityScore",
  "recencyScore",
  "popularityScore"
`

async function fetchWithVector(
  session: SessionProfile,
  limit: number,
  whereSql: Prisma.Sql
): Promise<CandidateProduct[] | null> {
  if (!session.embedding || session.embedding.length === 0) {
    return null
  }
  const vector = `[${session.embedding.join(',')}]`

  try {
    const rows = await prisma.$queryRaw<CandidateProduct[]>`
      SELECT
        ${SELECT_FIELDS},
        1 - (embedding <=> ${vector}::vector) AS similarity
      FROM "Product"
      WHERE status = 'APPROVED'
        AND availability != 'OUT_OF_STOCK'
        AND price > 0
        AND array_length(images, 1) > 0
        AND (${whereSql})
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${limit}
    `
    return rows
  } catch (error) {
    console.log('[recs][candidates] vector query failed', error)
    return null
  }
}

async function fetchFallback(
  where: Prisma.ProductWhereInput,
  limit: number
): Promise<CandidateProduct[]> {
  const products = await prisma.product.findMany({
    where,
    orderBy: [
      { qualityScore: 'desc' },
      { recencyScore: 'desc' },
      { popularityScore: 'desc' },
    ],
    take: Math.max(limit, VECTOR_FALLBACK_LIMIT),
  })

  return products.map((product: any) => ({
    id: product.id,
    title: product.title,
    description: product.description,
    price: product.price,
    currency: product.currency,
    images: product.images,
    affiliateUrl: product.affiliateUrl,
    categories: product.categories,
    retailer: product.retailer,
    source: product.source,
    availability: product.availability,
    vendorEmail: product.vendorEmail,
    regionMask: product.regionMask,
    primeEligible: product.primeEligible,
    freeShipping: product.freeShipping,
    deliveryDays: product.deliveryDays,
    sellerName: product.sellerName,
    sellerRating: product.sellerRating ?? undefined,
    bestSeller: product.bestSeller,
    marketplaceId: product.marketplaceId,
    listingType: product.listingType,
    qualityScore: product.qualityScore,
    recencyScore: product.recencyScore ?? undefined,
    popularityScore: product.popularityScore ?? undefined,
  }))
}

export async function fetchVendorCandidates(
  session: SessionProfile,
  limit: number
): Promise<CandidateProduct[]> {
  const vectorWhere = Prisma.sql`"vendorEmail" IS NOT NULL`
  const vectorResults = await fetchWithVector(session, limit, vectorWhere)
  if (vectorResults && vectorResults.length) {
    return vectorResults
  }

  const baseWhere: Prisma.ProductWhereInput = {
    status: 'APPROVED',
    availability: { not: 'OUT_OF_STOCK' },
    price: { gt: 0 },
    vendorEmail: { not: null },
    images: { isEmpty: false },
  }

  return fetchFallback(baseWhere, limit)
}

export async function fetchAffiliateCandidates(
  session: SessionProfile,
  limit: number
): Promise<CandidateProduct[]> {
  const vectorWhere = Prisma.sql`"vendorEmail" IS NULL`
  const vectorResults = await fetchWithVector(session, limit, vectorWhere)
  if (vectorResults && vectorResults.length) {
    return vectorResults
  }

  const baseWhere: Prisma.ProductWhereInput = {
    status: 'APPROVED',
    availability: { not: 'OUT_OF_STOCK' },
    price: { gt: 0 },
    vendorEmail: null,
    images: { isEmpty: false },
  }

  return fetchFallback(baseWhere, limit)
}

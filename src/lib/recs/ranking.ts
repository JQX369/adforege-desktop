import { CandidateProduct, RankedProduct } from './types'

interface RankingOptions {
  vendorBoost?: number
  interestBoost?: number
  diversify?: boolean
  maxPerRetailer?: number
  seenIds?: Set<string>
  negativeIds?: Set<string>
}

const DEFAULT_VENDOR_BOOST = 1.3
const DEFAULT_INTEREST_BOOST = 0.2
const DEFAULT_WEIGHT_QUALITY = 0.35
const DEFAULT_WEIGHT_RECENCY = 0.25
const DEFAULT_WEIGHT_POPULAR = 0.15
const DEFAULT_WEIGHT_SIMILARITY = 0.25

function computeBaseScore(
  product: CandidateProduct,
  similarityFallback = 0.5
): number {
  const similarity =
    typeof product.similarity === 'number'
      ? product.similarity
      : similarityFallback
  const quality = product.qualityScore ?? 0
  const recency = product.recencyScore ?? 0
  const popularity = product.popularityScore ?? 0

  const score =
    similarity * DEFAULT_WEIGHT_SIMILARITY +
    quality * DEFAULT_WEIGHT_QUALITY +
    recency * DEFAULT_WEIGHT_RECENCY +
    popularity * DEFAULT_WEIGHT_POPULAR

  return score
}

export function applyRanking(
  products: CandidateProduct[],
  interests: string[],
  options: RankingOptions = {}
): RankedProduct[] {
  const {
    vendorBoost = DEFAULT_VENDOR_BOOST,
    interestBoost = DEFAULT_INTEREST_BOOST,
    diversify = true,
    maxPerRetailer = 4,
    seenIds = new Set<string>(),
    negativeIds = new Set<string>(),
  } = options

  const interestLower = interests.map((i) => i.toLowerCase())
  const retailerCounts: Record<string, number> = {}

  const scored = products
    .filter(
      (product) => !seenIds.has(product.id) && !negativeIds.has(product.id)
    )
    .map((product) => {
      let score = computeBaseScore(product)

      if (product.vendorEmail) {
        score *= vendorBoost
      }

      // interest match boost
      const categories = (product.categories || []).map((c) => c.toLowerCase())
      const matches = interestLower.filter((interest) =>
        categories.some((cat) => cat.includes(interest))
      )
      if (matches.length) {
        score *= 1 + matches.length * interestBoost
      }

      // badges
      const badges: string[] = []
      if (product.vendorEmail) badges.push('Partner')
      if (product.primeEligible) badges.push('Prime')
      if (product.freeShipping) badges.push('Free Shipping')
      if (product.bestSeller) badges.push('Best Seller')

      return {
        ...product,
        finalScore: score,
        badges,
      } as CandidateProduct
    })
    .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))

  const diversified: RankedProduct[] = []

  for (const product of scored) {
    const retailer = product.retailer || 'unknown'
    if (diversify) {
      const count = retailerCounts[retailer] ?? 0
      if (count >= maxPerRetailer) {
        continue
      }
      retailerCounts[retailer] = count + 1
    }

    diversified.push({
      ...product,
      finalScore: product.finalScore ?? 0,
      rank: diversified.length + 1,
    })

    if (diversified.length >= 60) {
      break
    }
  }

  return diversified
}

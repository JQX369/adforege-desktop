import { RecommendationOptions, RecommendationResult } from './types'
import { fetchAffiliateCandidates, fetchVendorCandidates } from './candidates'
import { applyRanking } from './ranking'
import { applyLlmRerank } from './llm-rerank'
import { buildGeoInfo } from '@/src/shared/constants/geo'

const PAGE_SIZE_DEFAULT = 30

export async function getRecommendations(
  options: RecommendationOptions
): Promise<RecommendationResult> {
  const { session, page, pageSize = PAGE_SIZE_DEFAULT, country } = options
  const limit = pageSize * 2

  const [vendorCandidates, affiliateCandidates] = await Promise.all([
    fetchVendorCandidates(session, limit),
    fetchAffiliateCandidates(session, limit),
  ])

  const allCandidates = [...vendorCandidates, ...affiliateCandidates]

  const geoInfo = country ? buildGeoInfo(country) : null

  let ranked = applyRanking(
    allCandidates,
    session.constraints.interests ?? [],
    {
      seenIds: new Set(session.constraints.seenIds ?? []),
      negativeIds: new Set(session.constraints.excludeIds ?? []),
    }
  )

  if (process.env.RECS_LLM_RERANK_ENABLED === 'true') {
    ranked = await applyLlmRerank(ranked, { session, topN: pageSize })
  }

  const start = page * pageSize
  const pageProducts = ranked.slice(start, start + pageSize)
  const augmented = geoInfo
    ? pageProducts.map((product) => ({
        ...product,
        currency: product.currency || geoInfo.currency,
      }))
    : pageProducts
  const hasMore = ranked.length > start + pageProducts.length

  return {
    page,
    hasMore,
    products: augmented,
  }
}

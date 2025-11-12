import { ListingType, ProductCondition } from '@prisma/client'

export interface SessionConstraints {
  minPrice?: number
  maxPrice?: number
  interests: string[]
  occasion?: string
  relationship?: string
  region?: string
  country?: string
  excludeIds?: string[]
  seenIds?: string[]
}

export interface SessionProfile {
  sessionId: string
  embedding: number[] | null
  constraints: SessionConstraints
}

export interface CandidateProduct {
  id: string
  title: string
  description: string
  price: number
  currency?: string | null
  categories: string[]
  retailer?: string | null
  source: string
  availability: string
  vendorEmail?: string | null
  images: string[]
  affiliateUrl: string
  similarity?: number
  qualityScore?: number
  recencyScore?: number
  popularityScore?: number
  primeEligible?: boolean | null
  freeShipping?: boolean | null
  deliveryDays?: string | null
  sellerName?: string | null
  sellerRating?: number | null
  badges?: string[]
  bestSeller?: boolean | null
  condition?: ProductCondition
  marketplaceId?: string | null
  listingType?: ListingType | null
  regionMask?: string[] | null
  isVendor?: boolean
  sponsored?: boolean
  finalScore?: number
}

export interface RankedProduct extends CandidateProduct {
  finalScore: number
  rank: number
}

export interface RecommendationOptions {
  session: SessionProfile
  page: number
  pageSize?: number
  country?: string
  region?: string
}

export interface RecommendationResult {
  page: number
  hasMore: boolean
  products: RankedProduct[]
}

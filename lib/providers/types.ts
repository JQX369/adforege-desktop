/**
 * Shared types for product providers
 */

import {
  ProductSource,
  ProductCondition,
  AvailabilityStatus,
} from '@prisma/client'

export interface BaseProduct {
  // Identity
  title: string
  description: string
  shortDescription?: string
  
  // Pricing
  price: number
  originalPrice?: number
  discountPercent?: number
  currency: string
  
  // Media
  images: string[]
  imagesThumbnail?: string[]
  
  // Links
  url: string
  urlCanonical: string
  affiliateUrl: string
  
  // Categories & Tags
  categories: string[]
  brand?: string
  
  // Shipping & Delivery
  shippingCost?: number
  freeShipping: boolean
  deliveryDays?: string
  deliveryMin?: number
  deliveryMax?: number
  primeEligible?: boolean
  
  // Inventory
  inStock: boolean
  stockQuantity?: number
  availability: AvailabilityStatus
  available?: boolean
  lastCheckedAt?: string
  listingStartAt?: string
  listingEndAt?: string
  expiresAt?: Date | string
  
  // Quality & Reviews
  rating?: number
  numReviews?: number
  bestSeller?: boolean
  
  // Product Details
  features?: string[]
  weight?: number
  dimensions?: string
  condition: ProductCondition
  
  // Seller
  sellerName?: string
  sellerRating?: number
  
  // Provenance
  source: ProductSource
  retailer: string
  affiliateProgram: string
  sourceItemId?: string
  asin?: string
  merchantDomain: string
  marketplaceId?: string
  country?: string
  
  // Metadata
  qualityScore: number
  recencyScore?: number
  popularityScore?: number
  regionMask?: string[]
  tags?: Array<ProductTagInput | string>
  regionLinks?: ProductRegionLinkInput[]
}

export interface ProductTagInput {
  tag: string
  weight?: number
}

export interface ProductRegionLinkInput {
  country: string
  affiliateUrl: string
  currency?: string
  marketplaceId?: string
}

export interface ProviderConfig {
  apiKey?: string
  rateLimit?: number
  retryAttempts?: number
  timeout?: number
  defaultCountry?: string
}

export interface IngestionResult {
  success: boolean
  created: number
  updated: number
  skipped: number
  errors: number
  products: BaseProduct[]
  errorMessages: string[]
  duration: number
}

export interface ProviderStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  lastError?: string
  lastErrorTime?: Date
}

export abstract class BaseProvider {
  protected stats: ProviderStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
  }

  abstract searchByKeyword(keyword: string, limit?: number, geo?: { country: string; marketplaceId?: string; currency?: string }): Promise<BaseProduct[]>
  abstract getProductDetails?(id: string, geo?: { country: string; marketplaceId?: string; currency?: string }): Promise<BaseProduct | null>
  
  getStats(): ProviderStats {
    return { ...this.stats }
  }
  
  protected recordSuccess(duration: number): void {
    this.stats.totalRequests++
    this.stats.successfulRequests++
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (this.stats.successfulRequests - 1) + duration) / 
      this.stats.successfulRequests
  }
  
  protected recordFailure(error: string): void {
    this.stats.totalRequests++
    this.stats.failedRequests++
    this.stats.lastError = error
    this.stats.lastErrorTime = new Date()
  }
}

export interface QualityScoreBreakdown {
  hasPrice: number
  hasImages: number
  hasMultipleImages: number
  hasDescription: number
  hasShippingInfo: number
  hasDeliveryInfo: number
  hasRating: number
  hasStock: number
  hasEmbedding: number
  total: number
}


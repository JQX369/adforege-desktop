/**
 * Enhanced Rainforest API Provider
 * Captures ALL product data: pricing, shipping, delivery, images, ratings
 */

import {
  ProductSource,
  ProductCondition,
  AvailabilityStatus,
  ListingType,
} from '@prisma/client'
import {
  BaseProvider,
  BaseProduct,
  ProviderConfig,
  ProductRegionLinkInput,
} from './types'
import { buildAffiliateUrl, cleanProductUrl, isAmazonUrl } from '@/lib/affiliates'

interface RainforestSearchResult {
  asin?: string
  title?: string
  link?: string
  image?: string
  images?: Array<{ link: string }>
  prices?: Array<{
    symbol?: string
    value?: number
    currency?: string
    raw?: string
  }>
  price?: {
    symbol?: string
    value?: number
    currency?: string
    raw?: string
  }
  price_upper?: number
  unit_price?: string
  rating?: number
  ratings_total?: number
  is_prime?: boolean
  is_best_seller?: boolean
  categories?: Array<{ name: string }>
  availability?: {
    raw?: string
    type?: 'in_stock' | 'out_of_stock' | 'unknown'
  }
  delivery?: {
    date?: string
    raw?: string
    free?: boolean
    range?: {
      min?: number
      max?: number
    }
  }
}

interface RainforestProductDetail {
  asin?: string
  title?: string
  description?: string
  feature_bullets?: string[]
  link?: string
  images?: Array<{ link: string; variant?: string }>
  main_image?: { link: string }
  buybox_winner?: {
    price?: {
      value?: number
      currency?: string
      raw?: string
    }
    rrp?: {
      value?: number
      currency?: string
      raw?: string
    }
    shipping?: {
      raw?: string
      free?: boolean
    }
    availability?: {
      type?: string
      raw?: string
    }
  }
  rating?: number
  ratings_total?: number
  bestsellers_rank?: Array<{ category: string; rank: number }>
  specifications?: Array<{ name: string; value: string }>
  brand?: string
  categories?: Array<{ name: string }>
}

export class RainforestProvider extends BaseProvider {
  private apiKey: string
  private baseUrl = 'https://api.rainforestapi.com/request'
  private config: ProviderConfig

  constructor(apiKey: string, config: ProviderConfig = {}) {
    super()
    this.apiKey = apiKey
    this.config = {
      rateLimit: 2000, // 2 seconds between requests
      retryAttempts: 3,
      timeout: 30000,
      ...config,
    }
  }

  /**
   * Search Amazon products by keyword
   */
  async searchByKeyword(keyword: string, limit: number = 20): Promise<BaseProduct[]> {
    const startTime = Date.now()
    
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        type: 'search',
        amazon_domain: 'amazon.com',
        search_term: keyword,
        page: '1',
      })

      const response = await this.fetchWithRetry(`${this.baseUrl}?${params.toString()}`)
      const data = await response.json()

      if (!data.search_results || !Array.isArray(data.search_results)) {
        throw new Error('Invalid response format from Rainforest API')
      }

      const results = data.search_results.slice(0, limit)
      const products: BaseProduct[] = []

      for (const item of results) {
        try {
          const product = this.mapSearchResultToProduct(item)
          if (product) {
            products.push(product)
          }
        } catch (error) {
          console.error('Error mapping product:', error)
        }
      }

      this.recordSuccess(Date.now() - startTime)
      return products
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : 'Unknown error')
      throw error
    }
  }

  /**
   * Get detailed product information (for enrichment)
   */
  async getProductDetails(asin: string): Promise<BaseProduct | null> {
    const startTime = Date.now()
    
    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        type: 'product',
        amazon_domain: 'amazon.com',
        asin: asin,
      })

      const response = await this.fetchWithRetry(`${this.baseUrl}?${params.toString()}`)
      const data = await response.json()

      if (!data.product) {
        return null
      }

      const product = this.mapProductDetailToProduct(data.product)
      this.recordSuccess(Date.now() - startTime)
      return product
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : 'Unknown error')
      console.error('Error fetching product details:', error)
      return null
    }
  }

  /**
   * Map search result to BaseProduct
   */
  private mapSearchResultToProduct(item: RainforestSearchResult): BaseProduct | null {
    const title = item.title || ''
    const url = item.link || ''
    
    if (!title || !url || !isAmazonUrl(url)) {
      return null
    }

    const cleaned = cleanProductUrl(url)
    const price = item.price?.value || item.prices?.[0]?.value || 0
    const originalPrice = item.price_upper || undefined
    const currency = item.price?.currency || item.prices?.[0]?.currency || 'USD'
    
    // Calculate discount
    let discountPercent: number | undefined
    if (originalPrice && originalPrice > price && price > 0) {
      discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)
    }

    // Images
    const images: string[] = []
    const imagesThumbnail: string[] = []
    
    if (item.image) {
      images.push(item.image)
      imagesThumbnail.push(item.image)
    }
    
    if (item.images && Array.isArray(item.images)) {
      item.images.forEach(img => {
        if (img.link && !images.includes(img.link)) {
          images.push(img.link)
          imagesThumbnail.push(img.link)
        }
      })
    }

    // Categories
    const categories = (item.categories || []).map(c => c.name).filter(Boolean)

    // Shipping & Delivery
    const freeShipping = item.delivery?.free || false
    const deliveryDays = item.delivery?.raw || item.delivery?.date || undefined
    const deliveryMin = item.delivery?.range?.min
    const deliveryMax = item.delivery?.range?.max
    const primeEligible = item.is_prime || false

    // Availability
    let availability: AvailabilityStatus = AvailabilityStatus.UNKNOWN
    let inStock = true

    if (item.availability?.type === 'in_stock') {
      availability = AvailabilityStatus.IN_STOCK
      inStock = true
    } else if (item.availability?.type === 'out_of_stock') {
      availability = AvailabilityStatus.OUT_OF_STOCK
      inStock = false
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore({
      hasPrice: price > 0,
      hasImages: images.length > 0,
      hasMultipleImages: images.length > 1,
      hasDescription: false, // Not available in search results
      hasShippingInfo: freeShipping || deliveryDays !== undefined,
      hasDeliveryInfo: deliveryMin !== undefined || deliveryMax !== undefined,
      hasRating: item.rating !== undefined,
      hasStock: availability !== AvailabilityStatus.UNKNOWN,
    })

    const regionLinks: ProductRegionLinkInput[] = [
      {
        country: 'US',
        affiliateUrl: buildAffiliateUrl(cleaned, 'US'),
        currency,
        marketplaceId: 'ATVPDKIKX0DER',
      },
    ]

    return {
      title,
      description: '', // Not available in search results
      shortDescription: title.slice(0, 150),
      price,
      originalPrice,
      discountPercent,
      currency,
      images,
      imagesThumbnail,
      url,
      urlCanonical: cleaned,
      affiliateUrl: buildAffiliateUrl(cleaned, 'US'),
      categories,
      brand: undefined, // Not in search results
      shippingCost: freeShipping ? 0 : undefined,
      freeShipping,
      deliveryDays,
      deliveryMin,
      deliveryMax,
      primeEligible,
      inStock,
      stockQuantity: undefined,
      availability,
      rating: item.rating,
      numReviews: item.ratings_total,
      bestSeller: item.is_best_seller || false,
      features: undefined,
      weight: undefined,
      dimensions: undefined,
      condition: ProductCondition.NEW,
      sellerName: 'Amazon',
      sellerRating: undefined,
      source: ProductSource.AFFILIATE,
      retailer: 'Amazon',
      affiliateProgram: 'amazon',
      sourceItemId: item.asin,
      asin: item.asin,
      merchantDomain: 'amazon.com',
      qualityScore,
      marketplaceId: 'ATVPDKIKX0DER',
      regionLinks,
      country: 'US',
      listingType: ListingType.FIXED_PRICE,
    }
  }

  /**
   * Map detailed product info to BaseProduct (for enrichment)
   */
  private mapProductDetailToProduct(item: RainforestProductDetail): BaseProduct | null {
    const title = item.title || ''
    const url = item.link || ''
    
    if (!title || !url) {
      return null
    }

    const cleaned = cleanProductUrl(url)
    const buybox = item.buybox_winner
    const price = buybox?.price?.value || 0
    const originalPrice = buybox?.rrp?.value || undefined
    const currency = buybox?.price?.currency || 'USD'
    
    // Calculate discount
    let discountPercent: number | undefined
    if (originalPrice && originalPrice > price && price > 0) {
      discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100)
    }

    // Images
    const images: string[] = []
    const imagesThumbnail: string[] = []
    
    if (item.main_image?.link) {
      images.push(item.main_image.link)
      imagesThumbnail.push(item.main_image.link)
    }
    
    if (item.images && Array.isArray(item.images)) {
      item.images.forEach(img => {
        if (img.link && !images.includes(img.link)) {
          images.push(img.link)
          // Create thumbnail variant
          const thumbUrl = img.variant === 'THUMBNAIL' ? img.link : img.link.replace('._SL', '._SL200_')
          imagesThumbnail.push(thumbUrl)
        }
      })
    }

    // Categories
    const categories = (item.categories || []).map(c => c.name).filter(Boolean)

    // Features
    const features = item.feature_bullets || []

    // Shipping & Delivery
    const freeShipping = buybox?.shipping?.free || false
    const deliveryDays = buybox?.shipping?.raw

    // Availability
    let availability: AvailabilityStatus = AvailabilityStatus.UNKNOWN
    let inStock = true
    
    if (buybox?.availability?.type === 'in_stock') {
      availability = AvailabilityStatus.IN_STOCK
      inStock = true
    } else if (buybox?.availability?.type === 'out_of_stock') {
      availability = AvailabilityStatus.OUT_OF_STOCK
      inStock = false
    }

    // Specifications
    let weight: number | undefined
    let dimensions: string | undefined
    
    if (item.specifications) {
      for (const spec of item.specifications) {
        if (spec.name.toLowerCase().includes('weight')) {
          const weightMatch = spec.value.match(/(\d+\.?\d*)\s*(lb|lbs|pound|pounds|oz|ounces|kg|kilograms)/i)
          if (weightMatch) {
            weight = parseFloat(weightMatch[1])
          }
        }
        if (spec.name.toLowerCase().includes('dimension')) {
          dimensions = spec.value
        }
      }
    }

    // Best seller
    const bestSeller = item.bestsellers_rank && item.bestsellers_rank.length > 0 && item.bestsellers_rank[0].rank <= 100

    // Calculate quality score
    const qualityScore = this.calculateQualityScore({
      hasPrice: price > 0,
      hasImages: images.length > 0,
      hasMultipleImages: images.length > 2,
      hasDescription: !!item.description,
      hasShippingInfo: freeShipping || deliveryDays !== undefined,
      hasDeliveryInfo: deliveryDays !== undefined,
      hasRating: item.rating !== undefined,
      hasStock: availability !== AvailabilityStatus.UNKNOWN,
    })

    return {
      title,
      description: item.description || '',
      shortDescription: features[0] || title.slice(0, 150),
      price,
      originalPrice,
      discountPercent,
      currency,
      images,
      imagesThumbnail,
      url,
      urlCanonical: cleaned,
      affiliateUrl: buildAffiliateUrl(cleaned, 'US'),
      categories,
      brand: item.brand,
      shippingCost: freeShipping ? 0 : undefined,
      freeShipping,
      deliveryDays,
      deliveryMin: undefined,
      deliveryMax: undefined,
      primeEligible: undefined, // Not in product details endpoint
      inStock,
      stockQuantity: undefined,
      availability,
      rating: item.rating,
      numReviews: item.ratings_total,
      bestSeller: bestSeller || false,
      features,
      weight,
      dimensions,
      condition: ProductCondition.NEW,
      sellerName: 'Amazon',
      sellerRating: undefined,
      source: ProductSource.AFFILIATE,
      retailer: 'Amazon',
      affiliateProgram: 'amazon',
      sourceItemId: item.asin,
      asin: item.asin,
      merchantDomain: 'amazon.com',
      qualityScore,
      marketplaceId: 'ATVPDKIKX0DER',
      regionLinks: [
        {
          country: 'US',
          affiliateUrl: buildAffiliateUrl(cleaned, 'US'),
          currency,
          marketplaceId: 'ATVPDKIKX0DER',
        },
      ],
      country: 'US',
      listingType: ListingType.FIXED_PRICE,
    }
  }

  /**
   * Calculate quality score (0-1)
   */
  private calculateQualityScore(factors: {
    hasPrice: boolean
    hasImages: boolean
    hasMultipleImages: boolean
    hasDescription: boolean
    hasShippingInfo: boolean
    hasDeliveryInfo: boolean
    hasRating: boolean
    hasStock: boolean
  }): number {
    let score = 0
    
    if (factors.hasPrice) score += 0.15
    if (factors.hasImages) score += 0.15
    if (factors.hasMultipleImages) score += 0.05
    if (factors.hasDescription) score += 0.15
    if (factors.hasShippingInfo) score += 0.10
    if (factors.hasDeliveryInfo) score += 0.10
    if (factors.hasRating) score += 0.15
    if (factors.hasStock) score += 0.15
    
    return Math.min(score, 1.0)
  }

  /**
   * Fetch with retry logic and exponential backoff
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<Response> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'PresentGoGo/1.0',
        },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      // Rate limiting
      if (this.config.rateLimit) {
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimit))
      }

      return response
    } catch (error) {
      if (attempt < (this.config.retryAttempts || 3)) {
        const backoff = Math.pow(2, attempt) * 1000
        console.log(`Retry attempt ${attempt} after ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw error
    }
  }
}


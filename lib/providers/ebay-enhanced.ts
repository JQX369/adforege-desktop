/**
 * Enhanced eBay Browse API Provider
 * Captures ALL product data: pricing, shipping, delivery, condition, seller info
 */

import { ProductSource, ProductCondition, AvailabilityStatus, ProductStatus } from '@prisma/client'
import { BaseProvider, BaseProduct, ProviderConfig } from './types'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'

interface EbaySearchResult {
  itemId?: string
  title?: string
  price?: {
    value?: string
    currency?: string
  }
  image?: {
    imageUrl?: string
  }
  additionalImages?: Array<{ imageUrl: string }>
  itemWebUrl?: string
  categories?: Array<{ categoryId?: string; categoryName?: string }>
  condition?: string
  conditionId?: string
  seller?: {
    username?: string
    feedbackPercentage?: string
    feedbackScore?: number
  }
  shippingOptions?: Array<{
    shippingCostType?: string
    shippingCost?: {
      value?: string
      currency?: string
    }
    type?: string
    guaranteedDelivery?: boolean
    minEstimatedDeliveryDate?: string
    maxEstimatedDeliveryDate?: string
  }>
  itemLocation?: {
    city?: string
    stateOrProvince?: string
    country?: string
  }
  availableQuantity?: number
  buyingOptions?: string[]
  shortDescription?: string
}

export class EbayProvider extends BaseProvider {
  private appId: string
  private oauthToken: string
  private campaignId?: string
  private baseUrl = 'https://api.ebay.com/buy/browse/v1'
  private config: ProviderConfig

  constructor(
    appId: string,
    oauthToken: string,
    campaignId?: string,
    config: ProviderConfig = {}
  ) {
    super()
    this.appId = appId
    this.oauthToken = oauthToken
    this.campaignId = campaignId
    this.config = {
      rateLimit: 1000, // 1 second between requests
      retryAttempts: 3,
      timeout: 30000,
      ...config,
    }
  }

  /**
   * Search eBay products by keyword
   */
  async searchByKeyword(keyword: string, limit: number = 20): Promise<BaseProduct[]> {
    const startTime = Date.now()
    
    try {
      const params = new URLSearchParams({
        q: keyword,
        limit: Math.min(limit, 50).toString(),
        filter: 'buyingOptions:{FIXED_PRICE}', // Only Buy It Now items
      })

      const url = `${this.baseUrl}/item_summary/search?${params.toString()}`
      const response = await this.fetchWithRetry(url)
      const data = await response.json()

      if (!data.itemSummaries || !Array.isArray(data.itemSummaries)) {
        return []
      }

      const products: BaseProduct[] = []

      for (const item of data.itemSummaries) {
        try {
          const product = this.mapSearchResultToProduct(item)
          if (product) {
            products.push(product)
          }
        } catch (error) {
          console.error('Error mapping eBay product:', error)
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
   * Get detailed item information
   */
  async getProductDetails(itemId: string): Promise<BaseProduct | null> {
    const startTime = Date.now()
    
    try {
      const url = `${this.baseUrl}/item/${itemId}`
      const response = await this.fetchWithRetry(url)
      const data = await response.json()

      if (!data.itemId) {
        return null
      }

      const product = this.mapSearchResultToProduct(data)
      this.recordSuccess(Date.now() - startTime)
      return product
    } catch (error) {
      this.recordFailure(error instanceof Error ? error.message : 'Unknown error')
      console.error('Error fetching eBay item details:', error)
      return null
    }
  }

  /**
   * Map search result to BaseProduct
   */
  private mapSearchResultToProduct(item: EbaySearchResult): BaseProduct | null {
    const title = item.title || ''
    const url = item.itemWebUrl || ''
    
    if (!title || !url) {
      return null
    }

    const cleaned = cleanProductUrl(url)
    const price = parseFloat(item.price?.value || '0')
    const currency = item.price?.currency || 'USD'

    // Images
    const images: string[] = []
    const imagesThumbnail: string[] = []
    
    if (item.image?.imageUrl) {
      images.push(item.image.imageUrl)
      imagesThumbnail.push(item.image.imageUrl)
    }
    
    if (item.additionalImages && Array.isArray(item.additionalImages)) {
      item.additionalImages.forEach(img => {
        if (img.imageUrl && !images.includes(img.imageUrl)) {
          images.push(img.imageUrl)
          imagesThumbnail.push(img.imageUrl)
        }
      })
    }

    // Categories
    const categories = (item.categories || [])
      .map(c => c.categoryName)
      .filter((name): name is string => !!name)

    // Shipping
    const shippingOptions = item.shippingOptions || []
    const primaryShipping = shippingOptions[0]
    
    const shippingCost = primaryShipping?.shippingCost?.value 
      ? parseFloat(primaryShipping.shippingCost.value) 
      : undefined
    const freeShipping = shippingCost === 0 || primaryShipping?.shippingCost?.value === '0.00'

    // Delivery estimates
    let deliveryMin: number | undefined
    let deliveryMax: number | undefined
    let deliveryDays: string | undefined
    
    if (primaryShipping?.minEstimatedDeliveryDate && primaryShipping?.maxEstimatedDeliveryDate) {
      const minDate = new Date(primaryShipping.minEstimatedDeliveryDate)
      const maxDate = new Date(primaryShipping.maxEstimatedDeliveryDate)
      const now = new Date()
      
      deliveryMin = Math.ceil((minDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      deliveryMax = Math.ceil((maxDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      if (deliveryMin > 0 && deliveryMax > 0) {
        if (deliveryMin === deliveryMax) {
          deliveryDays = `${deliveryMin} days`
        } else {
          deliveryDays = `${deliveryMin}-${deliveryMax} days`
        }
      }
    }

    // Condition
    let condition = ProductCondition.NEW
    const conditionStr = (item.condition || '').toUpperCase()
    
    if (conditionStr.includes('NEW')) {
      condition = ProductCondition.NEW
    } else if (conditionStr.includes('LIKE NEW') || conditionStr.includes('LIKE_NEW')) {
      condition = ProductCondition.LIKE_NEW
    } else if (conditionStr.includes('VERY GOOD') || conditionStr.includes('EXCELLENT')) {
      condition = ProductCondition.USED_VERY_GOOD
    } else if (conditionStr.includes('GOOD')) {
      condition = ProductCondition.USED_GOOD
    } else if (conditionStr.includes('ACCEPTABLE') || conditionStr.includes('FAIR')) {
      condition = ProductCondition.USED_ACCEPTABLE
    } else if (conditionStr.includes('REFURBISHED') || conditionStr.includes('CERTIFIED')) {
      condition = ProductCondition.REFURBISHED
    }

    // Seller info
    const sellerName = item.seller?.username
    const sellerRating = item.seller?.feedbackPercentage 
      ? parseFloat(item.seller.feedbackPercentage) / 100 * 5 // Convert percentage to 5-star scale
      : undefined

    // Stock
    const stockQuantity = item.availableQuantity
    const inStock = stockQuantity ? stockQuantity > 0 : true
    const availability = inStock ? AvailabilityStatus.IN_STOCK : AvailabilityStatus.OUT_OF_STOCK

    // Build affiliate URL
    let affiliateUrl = cleaned
    if (this.campaignId) {
      try {
        const urlObj = new URL(cleaned)
        urlObj.searchParams.set('campid', this.campaignId)
        urlObj.searchParams.set('customid', `pg-${Date.now().toString(36)}`)
        affiliateUrl = urlObj.toString()
      } catch (e) {
        affiliateUrl = cleaned
      }
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore({
      hasPrice: price > 0,
      hasImages: images.length > 0,
      hasMultipleImages: images.length > 1,
      hasDescription: !!item.shortDescription,
      hasShippingInfo: shippingCost !== undefined,
      hasDeliveryInfo: deliveryMin !== undefined,
      hasRating: sellerRating !== undefined,
      hasStock: stockQuantity !== undefined,
      hasSeller: !!sellerName,
    })

    return {
      title,
      description: item.shortDescription || '',
      shortDescription: item.shortDescription || title.slice(0, 150),
      price,
      originalPrice: undefined,
      discountPercent: undefined,
      currency,
      images,
      imagesThumbnail,
      url,
      urlCanonical: cleaned,
      affiliateUrl,
      categories,
      brand: undefined,
      shippingCost,
      freeShipping,
      deliveryDays,
      deliveryMin,
      deliveryMax,
      primeEligible: undefined,
      inStock,
      stockQuantity,
      availability,
      rating: sellerRating,
      numReviews: item.seller?.feedbackScore,
      bestSeller: false,
      features: undefined,
      weight: undefined,
      dimensions: undefined,
      condition,
      sellerName,
      sellerRating,
      source: ProductSource.AFFILIATE,
      retailer: 'eBay',
      affiliateProgram: 'ebay',
      sourceItemId: item.itemId,
      asin: undefined,
      merchantDomain: 'ebay.com',
      qualityScore,
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
    hasSeller: boolean
  }): number {
    let score = 0
    
    if (factors.hasPrice) score += 0.15
    if (factors.hasImages) score += 0.15
    if (factors.hasMultipleImages) score += 0.05
    if (factors.hasDescription) score += 0.10
    if (factors.hasShippingInfo) score += 0.10
    if (factors.hasDeliveryInfo) score += 0.10
    if (factors.hasRating) score += 0.10
    if (factors.hasStock) score += 0.15
    if (factors.hasSeller) score += 0.10
    
    return Math.min(score, 1.0)
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<Response> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.oauthToken}`,
          'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=94016',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`eBay API error: ${response.status} ${response.statusText}`)
      }

      // Rate limiting
      if (this.config.rateLimit) {
        await new Promise(resolve => setTimeout(resolve, this.config.rateLimit))
      }

      return response
    } catch (error) {
      if (attempt < (this.config.retryAttempts || 3)) {
        const backoff = Math.pow(2, attempt) * 1000
        console.log(`eBay retry attempt ${attempt} after ${backoff}ms...`)
        await new Promise(resolve => setTimeout(resolve, backoff))
        return this.fetchWithRetry(url, attempt + 1)
      }
      throw error
    }
  }
}


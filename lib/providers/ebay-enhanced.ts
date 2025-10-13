/**
 * Enhanced eBay Browse API Provider
 * Captures ALL product data: pricing, shipping, delivery, condition, seller info
 */

import {
  ProductSource,
  ProductCondition,
  AvailabilityStatus,
} from '@prisma/client'
import {
  BaseProvider,
  BaseProduct,
  ProviderConfig,
  ProductRegionLinkInput,
} from './types'
import { buildAffiliateUrl, cleanProductUrl } from '@/lib/affiliates'
import { buildGeoInfo, COUNTRY_TO_EBAY_MARKETPLACE } from '@/lib/geo'
import { IngestionEngine } from '@/lib/providers/ingestion-engine'

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
  private static cachedToken: { token: string; exp: number } | null = null

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

  private async getAppToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000)
    if (EbayProvider.cachedToken && EbayProvider.cachedToken.exp - 120 > now) {
      return EbayProvider.cachedToken.token
    }
    const clientId = process.env.EBAY_CLIENT_ID || process.env.EBAY_APP_ID
    const clientSecret = process.env.EBAY_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Missing EBAY_CLIENT_ID/EBAY_CLIENT_SECRET')
    }
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const params = new URLSearchParams()
    params.set('grant_type', 'client_credentials')
    params.set('scope', 'https://api.ebay.com/oauth/api_scope')
    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: params.toString(),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`eBay token error: ${res.status} ${text}`)
    }
    const json = (await res.json()) as { access_token: string; expires_in: number }
    EbayProvider.cachedToken = { token: json.access_token, exp: now + (json.expires_in || 7200) }
    return EbayProvider.cachedToken.token
  }

  /**
   * Search eBay products by keyword
   */
  async searchByKeyword(
    keyword: string,
    limit: number = 20,
    geo?: { country: string; marketplaceId?: string; currency?: string }
  ): Promise<BaseProduct[]> {
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
  async getProductDetails(itemId: string, geo?: { country: string; marketplaceId?: string; currency?: string }): Promise<BaseProduct | null> {
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
    let condition: ProductCondition = ProductCondition.NEW
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

    const affiliateUrl = buildAffiliateUrl(cleaned)

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

    const regionLinks: ProductRegionLinkInput[] = []
    const country = item.itemLocation?.country || 'US'
    regionLinks.push({
      country,
      affiliateUrl,
      currency,
      marketplaceId: this.resolveMarketplaceId(country),
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
      marketplaceId: this.resolveMarketplaceId(country),
      country,
      regionLinks,
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

  private resolveMarketplaceId(country: string | undefined): string | undefined {
    switch ((country || 'US').toUpperCase()) {
      case 'GB':
      case 'UK':
        return 'EBAY_GB'
      case 'DE':
        return 'EBAY_DE'
      case 'AU':
        return 'EBAY_AU'
      case 'CA':
        return 'EBAY_CA'
      default:
        return 'EBAY_US'
    }
  }


  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<Response> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), this.config.timeout)

      // Always use current app token (auto-refresh)
      const token = await this.getAppToken()
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-EBAY-C-ENDUSERCTX': 'contextualLocation=country=US,zip=94016',
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
          'Content-Type': 'application/json',
        },
      })

      clearTimeout(timeout)

      if (!response.ok) {
        // If 401, clear cache and retry once immediately (respecting backoff below)
        if (response.status === 401) {
          EbayProvider.cachedToken = null
        }
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

export async function syncEbayByKeyword(
  keyword: string,
  options: { limit?: number; country?: string } = {}
) {
  const clientId = process.env.EBAY_APP_ID || process.env.EBAY_CLIENT_ID
  const oauthToken = process.env.EBAY_OAUTH_TOKEN
  if (!clientId || !oauthToken) {
    console.warn('[ebay] Missing credentials; skipping sync')
    return { created: 0, updated: 0, skipped: 0, errors: 1, errorMessages: ['missing ebay credentials'], products: [], success: false, duration: 0 }
  }

  const { limit = 20, country = 'US' } = options
  const geo = buildGeoInfo(country)
  const provider = new EbayProvider(clientId, oauthToken, process.env.EBAY_CAMPAIGN_ID)
  const products = await provider.searchByKeyword(keyword, limit, geo)

  const engine = new IngestionEngine()
  try {
    const result = await engine.ingestProducts(products)
    return result
  } finally {
    await engine.disconnect()
  }
}


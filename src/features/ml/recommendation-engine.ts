import { PrismaClient } from '@prisma/client'
import {
  SessionProfile,
  CandidateProduct,
  RankedProduct,
  RecommendationOptions,
  RecommendationResult,
} from '@/lib/recs/types'

const prisma = new PrismaClient()

// ML Model Configuration
interface MLConfig {
  // Collaborative Filtering
  collaborativeFiltering: {
    enabled: boolean
    minUsers: number
    minInteractions: number
    similarityThreshold: number
  }

  // Content-Based Filtering
  contentBased: {
    enabled: boolean
    embeddingWeight: number
    categoryWeight: number
    priceWeight: number
    ratingWeight: number
  }

  // Deep Learning
  deepLearning: {
    enabled: boolean
    modelPath: string
    batchSize: number
    predictionThreshold: number
  }

  // Hybrid Approach
  hybrid: {
    enabled: boolean
    collaborativeWeight: number
    contentWeight: number
    deepWeight: number
    demographicWeight: number
  }

  // Niche Targeting
  nicheTargeting: {
    enabled: boolean
    nicheThreshold: number
    diversityBoost: number
    noveltyBoost: number
  }
}

const DEFAULT_CONFIG: MLConfig = {
  collaborativeFiltering: {
    enabled: true,
    minUsers: 10,
    minInteractions: 5,
    similarityThreshold: 0.3,
  },
  contentBased: {
    enabled: true,
    embeddingWeight: 0.4,
    categoryWeight: 0.3,
    priceWeight: 0.2,
    ratingWeight: 0.1,
  },
  deepLearning: {
    enabled: false, // Will be enabled when model is trained
    modelPath: './models/recommendation-model.json',
    batchSize: 32,
    predictionThreshold: 0.5,
  },
  hybrid: {
    enabled: true,
    collaborativeWeight: 0.3,
    contentWeight: 0.4,
    deepWeight: 0.2,
    demographicWeight: 0.1,
  },
  nicheTargeting: {
    enabled: true,
    nicheThreshold: 0.7,
    diversityBoost: 0.1,
    noveltyBoost: 0.15,
  },
}

// User Preference Learning
interface UserPreferences {
  userId: string
  preferences: {
    categories: Record<string, number>
    priceRange: { min: number; max: number; preferred: number }
    brands: Record<string, number>
    occasions: Record<string, number>
    relationships: Record<string, number>
    demographics: {
      ageGroup: string
      gender: string
      location: string
    }
  }
  behavior: {
    clickRate: number
    saveRate: number
    purchaseRate: number
    sessionDuration: number
    bounceRate: number
  }
  history: {
    totalInteractions: number
    lastActive: Date
    favoriteCategories: string[]
    dislikedCategories: string[]
  }
}

// Niche Detection
interface NicheProfile {
  category: string
  subcategories: string[]
  priceRange: { min: number; max: number }
  demographics: {
    ageGroups: string[]
    genders: string[]
    locations: string[]
  }
  behavior: {
    avgClickRate: number
    avgSaveRate: number
    avgPurchaseRate: number
  }
  popularity: {
    totalUsers: number
    growthRate: number
    seasonality: Record<string, number>
  }
}

class AdvancedRecommendationEngine {
  private config: MLConfig
  private userPreferences: Map<string, UserPreferences> = new Map()
  private nicheProfiles: Map<string, NicheProfile> = new Map()

  constructor(config: Partial<MLConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // Main recommendation method
  async getRecommendations(
    options: RecommendationOptions
  ): Promise<RecommendationResult> {
    const { session, page, pageSize = 20 } = options

    try {
      // 1. Load user preferences
      const userPrefs = await this.loadUserPreferences(session.sessionId)

      // 2. Get candidate products
      const candidates = await this.getCandidateProducts(session, pageSize * 3)

      // 3. Apply ML models
      const ranked = await this.applyMLModels(candidates, userPrefs, session)

      // 4. Apply niche targeting
      const nicheTargeted = await this.applyNicheTargeting(ranked, userPrefs)

      // 5. Apply diversity and novelty
      const diversified = this.applyDiversityAndNovelty(nicheTargeted, session)

      // 6. Paginate results
      const start = page * pageSize
      const products = diversified.slice(start, start + pageSize)

      return {
        page,
        hasMore: diversified.length > start + pageSize,
        products,
      }
    } catch (error) {
      console.error('Advanced recommendation error:', error)
      throw error
    }
  }

  // Load user preferences from database
  private async loadUserPreferences(
    sessionId: string
  ): Promise<UserPreferences | null> {
    try {
      // Check cache first
      if (this.userPreferences.has(sessionId)) {
        return this.userPreferences.get(sessionId)!
      }

      // Load from database
      const user = await prisma.user.findUnique({
        where: { id: sessionId },
        include: {
          swipes: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!user) return null

      // Analyze user behavior
      const preferences = await this.analyzeUserBehavior(user)

      // Cache preferences
      this.userPreferences.set(sessionId, preferences)

      return preferences
    } catch (error) {
      console.error('Error loading user preferences:', error)
      return null
    }
  }

  // Analyze user behavior to build preferences
  private async analyzeUserBehavior(user: any): Promise<UserPreferences> {
    const swipes = user.swipes || []
    const likes = swipes.filter((s: any) => s.action === 'LIKE')
    const dislikes = swipes.filter((s: any) => s.action === 'DISLIKE')
    const saves = swipes.filter((s: any) => s.action === 'SAVE')

    // Category preferences
    const categoryPrefs: Record<string, number> = {}
    likes.forEach((swipe: any) => {
      const product = swipe.product
      if (product.categories) {
        product.categories.forEach((category: string) => {
          categoryPrefs[category] = (categoryPrefs[category] || 0) + 1
        })
      }
    })

    // Price preferences
    const prices = likes
      .map((swipe: any) => swipe.product.price)
      .filter(Boolean)
    const priceRange =
      prices.length > 0
        ? {
            min: Math.min(...prices),
            max: Math.max(...prices),
            preferred: prices.reduce((a, b) => a + b, 0) / prices.length,
          }
        : { min: 0, max: 1000, preferred: 50 }

    // Brand preferences
    const brandPrefs: Record<string, number> = {}
    likes.forEach((swipe: any) => {
      const brand = swipe.product.brand
      if (brand) {
        brandPrefs[brand] = (brandPrefs[brand] || 0) + 1
      }
    })

    // Behavior metrics
    const totalInteractions = swipes.length
    const clickRate =
      totalInteractions > 0 ? likes.length / totalInteractions : 0
    const saveRate =
      totalInteractions > 0 ? saves.length / totalInteractions : 0
    const purchaseRate = 0 // Would need purchase data

    return {
      userId: user.id,
      preferences: {
        categories: categoryPrefs,
        priceRange,
        brands: brandPrefs,
        occasions: {}, // Would need occasion data
        relationships: {}, // Would need relationship data
        demographics: {
          ageGroup: 'unknown',
          gender: 'unknown',
          location: 'unknown',
        },
      },
      behavior: {
        clickRate,
        saveRate,
        purchaseRate,
        sessionDuration: 0, // Would need session data
        bounceRate: 0, // Would need session data
      },
      history: {
        totalInteractions,
        lastActive: new Date(),
        favoriteCategories: Object.keys(categoryPrefs).slice(0, 5),
        dislikedCategories: [], // Would need dislike analysis
      },
    }
  }

  // Get candidate products
  private async getCandidateProducts(
    session: SessionProfile,
    limit: number
  ): Promise<CandidateProduct[]> {
    try {
      // Use vector similarity if embedding exists
      if (session.embedding && session.embedding.length > 0) {
        return await this.getVectorSimilarProducts(session, limit)
      }

      // Fallback to content-based filtering
      return await this.getContentBasedProducts(session, limit)
    } catch (error) {
      console.error('Error getting candidate products:', error)
      return []
    }
  }

  // Vector similarity search
  private async getVectorSimilarProducts(
    session: SessionProfile,
    limit: number
  ): Promise<CandidateProduct[]> {
    const embedding = session.embedding!

    // Use Prisma's vector similarity search (if supported)
    const products = (await prisma.$queryRaw`
      SELECT 
        p.id, p.title, p.description, p.price, p.currency, p.categories,
        p.retailer, p.source, p.availability, p."vendorEmail", p.images,
        p."affiliateUrl", p."qualityScore", p."recencyScore", p."popularityScore",
        p."primeEligible", p."freeShipping", p."deliveryDays", p."sellerName",
        p."sellerRating", p."bestSeller", p.condition, p."marketplaceId",
        p."listingType", p."regionMask",
        (p.embedding <-> ${JSON.stringify(embedding)}::vector) as similarity
      FROM "Product" p
      WHERE p.status = 'APPROVED' 
        AND p."inStock" = true
        AND p.availability = 'IN_STOCK'
      ORDER BY similarity ASC
      LIMIT ${limit}
    `) as any[]

    return products.map((product) => ({
      ...product,
      similarity: 1 - product.similarity, // Convert distance to similarity
      isVendor: !!product.vendorEmail,
      sponsored: false,
    }))
  }

  // Content-based filtering
  private async getContentBasedProducts(
    session: SessionProfile,
    limit: number
  ): Promise<CandidateProduct[]> {
    const { constraints } = session
    const { interests, minPrice, maxPrice } = constraints

    const products = await prisma.product.findMany({
      where: {
        status: 'APPROVED',
        inStock: true,
        availability: 'IN_STOCK',
        ...(minPrice && { price: { gte: minPrice } }),
        ...(maxPrice && { price: { lte: maxPrice } }),
        ...(interests.length > 0 && {
          categories: {
            hasSome: interests,
          },
        }),
      },
      orderBy: [
        { qualityScore: 'desc' },
        { popularityScore: 'desc' },
        { rating: 'desc' },
      ],
      take: limit,
    })

    return products.map((product) => ({
      ...product,
      similarity: 0.5, // Default similarity
      isVendor: !!product.vendorEmail,
      sponsored: false,
    }))
  }

  // Apply ML models
  private async applyMLModels(
    candidates: CandidateProduct[],
    userPrefs: UserPreferences | null,
    session: SessionProfile
  ): Promise<RankedProduct[]> {
    const scored = candidates.map((product) => {
      let score = 0

      // Content-based scoring
      if (this.config.contentBased.enabled) {
        score +=
          this.calculateContentBasedScore(product, userPrefs) *
          this.config.hybrid.contentWeight
      }

      // Collaborative filtering
      if (this.config.collaborativeFiltering.enabled) {
        score +=
          this.calculateCollaborativeScore(product, userPrefs) *
          this.config.hybrid.collaborativeWeight
      }

      // Deep learning (placeholder)
      if (this.config.deepLearning.enabled) {
        score +=
          this.calculateDeepLearningScore(product, userPrefs) *
          this.config.hybrid.deepWeight
      }

      // Demographic scoring
      score +=
        this.calculateDemographicScore(product, userPrefs) *
        this.config.hybrid.demographicWeight

      return {
        ...product,
        finalScore: score,
        rank: 0,
      } as RankedProduct
    })

    return scored.sort((a, b) => b.finalScore - a.finalScore)
  }

  // Content-based scoring
  private calculateContentBasedScore(
    product: CandidateProduct,
    userPrefs: UserPreferences | null
  ): number {
    if (!userPrefs) return 0.5

    let score = 0

    // Category matching
    const categoryScore =
      product.categories.reduce((acc, category) => {
        return acc + (userPrefs.preferences.categories[category] || 0)
      }, 0) / Math.max(product.categories.length, 1)

    score += categoryScore * this.config.contentBased.categoryWeight

    // Price matching
    const { min, max, preferred } = userPrefs.preferences.priceRange
    const priceScore =
      product.price >= min && product.price <= max
        ? 1 - Math.abs(product.price - preferred) / (max - min)
        : 0

    score += priceScore * this.config.contentBased.priceWeight

    // Rating
    const ratingScore = (product.qualityScore || 0) / 100
    score += ratingScore * this.config.contentBased.ratingWeight

    // Embedding similarity
    const embeddingScore = product.similarity || 0
    score += embeddingScore * this.config.contentBased.embeddingWeight

    return Math.min(score, 1)
  }

  // Collaborative filtering scoring
  private calculateCollaborativeScore(
    product: CandidateProduct,
    userPrefs: UserPreferences | null
  ): number {
    // Simplified collaborative filtering
    // In a real implementation, this would use user-item interaction matrix
    if (!userPrefs) return 0.5

    // Use product popularity as proxy for collaborative score
    const popularityScore = (product.popularityScore || 0) / 100
    const qualityScore = (product.qualityScore || 0) / 100

    return (popularityScore + qualityScore) / 2
  }

  // Deep learning scoring (placeholder)
  private calculateDeepLearningScore(
    product: CandidateProduct,
    userPrefs: UserPreferences | null
  ): number {
    // Placeholder for deep learning model
    // Would use trained neural network to predict user preference
    return 0.5
  }

  // Demographic scoring
  private calculateDemographicScore(
    product: CandidateProduct,
    userPrefs: UserPreferences | null
  ): number {
    if (!userPrefs) return 0.5

    // Simplified demographic scoring
    // In a real implementation, this would use demographic data
    const baseScore = 0.5

    // Adjust based on product characteristics
    if (
      product.categories.includes('Electronics') &&
      userPrefs.preferences.demographics.ageGroup === '18-34'
    ) {
      return baseScore + 0.2
    }

    if (
      product.categories.includes('Books') &&
      userPrefs.preferences.demographics.ageGroup === '35-54'
    ) {
      return baseScore + 0.15
    }

    return baseScore
  }

  // Apply niche targeting
  private async applyNicheTargeting(
    products: RankedProduct[],
    userPrefs: UserPreferences | null
  ): Promise<RankedProduct[]> {
    if (!this.config.nicheTargeting.enabled || !userPrefs) return products

    return products.map((product) => {
      let nicheScore = 0

      // Check if product belongs to user's niche interests
      const userCategories = Object.keys(userPrefs.preferences.categories)
      const productCategories = product.categories

      const categoryOverlap = productCategories.filter((cat) =>
        userCategories.includes(cat)
      ).length
      const nicheRatio = categoryOverlap / Math.max(productCategories.length, 1)

      if (nicheRatio >= this.config.nicheTargeting.nicheThreshold) {
        nicheScore = this.config.nicheTargeting.nicheThreshold
      }

      return {
        ...product,
        finalScore: product.finalScore + nicheScore,
      }
    })
  }

  // Apply diversity and novelty
  private applyDiversityAndNovelty(
    products: RankedProduct[],
    session: SessionProfile
  ): RankedProduct[] {
    const diversified: RankedProduct[] = []
    const seenCategories = new Set<string>()
    const seenRetailers = new Set<string>()
    const seenIds = new Set(session.constraints.seenIds || [])

    for (const product of products) {
      // Skip seen products
      if (seenIds.has(product.id)) continue

      // Apply diversity boost
      const categoryDiversity = product.categories.some(
        (cat) => !seenCategories.has(cat)
      )
      const retailerDiversity = !seenRetailers.has(
        product.retailer || 'unknown'
      )

      if (categoryDiversity || retailerDiversity) {
        product.finalScore += this.config.nicheTargeting.diversityBoost
      }

      // Apply novelty boost for new/trending products
      if (product.recencyScore && product.recencyScore > 0.8) {
        product.finalScore += this.config.nicheTargeting.noveltyBoost
      }

      diversified.push(product)

      // Track seen categories and retailers
      product.categories.forEach((cat) => seenCategories.add(cat))
      if (product.retailer) seenRetailers.add(product.retailer)

      if (diversified.length >= 100) break
    }

    return diversified.sort((a, b) => b.finalScore - a.finalScore)
  }

  // Update user preferences based on interaction
  async updateUserPreferences(
    sessionId: string,
    productId: string,
    action: 'LIKE' | 'DISLIKE' | 'SAVE' | 'CLICK'
  ) {
    try {
      const userPrefs = await this.loadUserPreferences(sessionId)
      if (!userPrefs) return

      // Update preferences based on action
      // This would be implemented to learn from user behavior
      console.log(
        `Updating preferences for user ${sessionId}, product ${productId}, action ${action}`
      )

      // Invalidate cache to force reload
      this.userPreferences.delete(sessionId)
    } catch (error) {
      console.error('Error updating user preferences:', error)
    }
  }

  // Get niche profiles
  async getNicheProfiles(): Promise<NicheProfile[]> {
    try {
      // Load niche profiles from database
      const niches = (await prisma.$queryRaw`
        SELECT 
          category,
          COUNT(*) as user_count,
          AVG(price) as avg_price,
          AVG(rating) as avg_rating
        FROM "Product" p
        WHERE p.status = 'APPROVED'
        GROUP BY category
        ORDER BY user_count DESC
        LIMIT 20
      `) as any[]

      return niches.map((niche) => ({
        category: niche.category,
        subcategories: [],
        priceRange: { min: 0, max: 1000 },
        demographics: {
          ageGroups: [],
          genders: [],
          locations: [],
        },
        behavior: {
          avgClickRate: 0.1,
          avgSaveRate: 0.05,
          avgPurchaseRate: 0.02,
        },
        popularity: {
          totalUsers: niche.user_count,
          growthRate: 0.1,
          seasonality: {},
        },
      }))
    } catch (error) {
      console.error('Error getting niche profiles:', error)
      return []
    }
  }
}

export { AdvancedRecommendationEngine, MLConfig, UserPreferences, NicheProfile }

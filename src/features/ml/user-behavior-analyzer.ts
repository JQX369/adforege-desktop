import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// User Behavior Analysis
interface BehaviorPattern {
  userId: string
  patterns: {
    browsing: {
      avgSessionDuration: number
      pagesPerSession: number
      bounceRate: number
      returnRate: number
    }
    interaction: {
      clickRate: number
      saveRate: number
      likeRate: number
      dislikeRate: number
      shareRate: number
    }
    preference: {
      categoryPreferences: Record<string, number>
      pricePreferences: { min: number; max: number; preferred: number }
      brandPreferences: Record<string, number>
      occasionPreferences: Record<string, number>
    }
    timing: {
      peakHours: number[]
      peakDays: string[]
      seasonalPatterns: Record<string, number>
    }
  }
  segments: {
    userType: 'browser' | 'buyer' | 'collector' | 'casual'
    engagementLevel: 'low' | 'medium' | 'high'
    priceSensitivity: 'low' | 'medium' | 'high'
    brandLoyalty: 'low' | 'medium' | 'high'
  }
  predictions: {
    nextPurchaseProbability: number
    preferredCategories: string[]
    optimalPriceRange: { min: number; max: number }
    bestEngagementTime: string
  }
}

// Session Analysis
interface SessionAnalysis {
  sessionId: string
  userId: string
  startTime: Date
  endTime: Date
  duration: number
  actions: Array<{
    type:
      | 'page_view'
      | 'product_view'
      | 'click'
      | 'save'
      | 'like'
      | 'dislike'
      | 'share'
    timestamp: Date
    productId?: string
    category?: string
    price?: number
  }>
  metrics: {
    totalActions: number
    uniqueProducts: number
    categoriesViewed: string[]
    priceRange: { min: number; max: number }
    engagementScore: number
  }
}

// Cohort Analysis
interface CohortAnalysis {
  cohort: string
  period: 'daily' | 'weekly' | 'monthly'
  metrics: {
    size: number
    retention: number[]
    engagement: number[]
    conversion: number[]
    revenue: number[]
  }
  insights: {
    topPerformingCohorts: string[]
    retentionDrivers: string[]
    engagementFactors: string[]
  }
}

class UserBehaviorAnalyzer {
  // Analyze user behavior patterns
  async analyzeUserBehavior(userId: string): Promise<BehaviorPattern | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          swipes: {
            include: {
              product: true,
            },
          },
        },
      })

      if (!user) return null

      const swipes = user.swipes || []
      const likes = swipes.filter((s) => s.action === 'LIKE')
      const dislikes = swipes.filter((s) => s.action === 'DISLIKE')
      const saves = swipes.filter((s) => s.action === 'SAVE')

      // Calculate interaction rates
      const totalInteractions = swipes.length
      const clickRate =
        totalInteractions > 0 ? likes.length / totalInteractions : 0
      const saveRate =
        totalInteractions > 0 ? saves.length / totalInteractions : 0
      const likeRate =
        totalInteractions > 0 ? likes.length / totalInteractions : 0
      const dislikeRate =
        totalInteractions > 0 ? dislikes.length / totalInteractions : 0

      // Analyze category preferences
      const categoryPreferences: Record<string, number> = {}
      likes.forEach((swipe) => {
        const product = swipe.product
        if (product.categories) {
          product.categories.forEach((category) => {
            categoryPreferences[category] =
              (categoryPreferences[category] || 0) + 1
          })
        }
      })

      // Analyze price preferences
      const prices = likes.map((swipe) => swipe.product.price).filter(Boolean)
      const pricePreferences =
        prices.length > 0
          ? {
              min: Math.min(...prices),
              max: Math.max(...prices),
              preferred: prices.reduce((a, b) => a + b, 0) / prices.length,
            }
          : { min: 0, max: 1000, preferred: 50 }

      // Analyze brand preferences
      const brandPreferences: Record<string, number> = {}
      likes.forEach((swipe) => {
        const brand = swipe.product.brand
        if (brand) {
          brandPreferences[brand] = (brandPreferences[brand] || 0) + 1
        }
      })

      // Determine user segments
      const userType = this.determineUserType(swipes, saves, likes)
      const engagementLevel = this.determineEngagementLevel(
        totalInteractions,
        clickRate,
        saveRate
      )
      const priceSensitivity = this.determinePriceSensitivity(
        pricePreferences,
        prices
      )
      const brandLoyalty = this.determineBrandLoyalty(brandPreferences)

      // Generate predictions
      const predictions = this.generatePredictions(
        categoryPreferences,
        pricePreferences,
        userType
      )

      return {
        userId,
        patterns: {
          browsing: {
            avgSessionDuration: 0, // Would need session data
            pagesPerSession: 0,
            bounceRate: 0,
            returnRate: 0,
          },
          interaction: {
            clickRate,
            saveRate,
            likeRate,
            dislikeRate,
            shareRate: 0,
          },
          preference: {
            categoryPreferences,
            pricePreferences,
            brandPreferences,
            occasionPreferences: {},
          },
          timing: {
            peakHours: [],
            peakDays: [],
            seasonalPatterns: {},
          },
        },
        segments: {
          userType,
          engagementLevel,
          priceSensitivity,
          brandLoyalty,
        },
        predictions,
      }
    } catch (error) {
      console.error('Error analyzing user behavior:', error)
      return null
    }
  }

  // Determine user type based on behavior
  private determineUserType(
    swipes: any[],
    saves: any[],
    likes: any[]
  ): 'browser' | 'buyer' | 'collector' | 'casual' {
    const totalActions = swipes.length
    const saveRate = totalActions > 0 ? saves.length / totalActions : 0
    const likeRate = totalActions > 0 ? likes.length / totalActions : 0

    if (saveRate > 0.3) return 'collector'
    if (likeRate > 0.5 && totalActions > 20) return 'buyer'
    if (totalActions > 10) return 'browser'
    return 'casual'
  }

  // Determine engagement level
  private determineEngagementLevel(
    totalActions: number,
    clickRate: number,
    saveRate: number
  ): 'low' | 'medium' | 'high' {
    const engagementScore =
      totalActions * 0.3 + clickRate * 0.4 + saveRate * 0.3

    if (engagementScore > 0.7) return 'high'
    if (engagementScore > 0.4) return 'medium'
    return 'low'
  }

  // Determine price sensitivity
  private determinePriceSensitivity(
    pricePrefs: any,
    prices: number[]
  ): 'low' | 'medium' | 'high' {
    if (prices.length === 0) return 'medium'

    const priceRange = pricePrefs.max - pricePrefs.min
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length

    if (priceRange < avgPrice * 0.3) return 'low'
    if (priceRange > avgPrice * 0.7) return 'high'
    return 'medium'
  }

  // Determine brand loyalty
  private determineBrandLoyalty(
    brandPrefs: Record<string, number>
  ): 'low' | 'medium' | 'high' {
    const brands = Object.keys(brandPrefs)
    if (brands.length === 0) return 'medium'

    const totalBrandInteractions = Object.values(brandPrefs).reduce(
      (a, b) => a + b,
      0
    )
    const maxBrandInteractions = Math.max(...Object.values(brandPrefs))
    const brandConcentration = maxBrandInteractions / totalBrandInteractions

    if (brandConcentration > 0.6) return 'high'
    if (brandConcentration > 0.3) return 'medium'
    return 'low'
  }

  // Generate predictions
  private generatePredictions(
    categoryPrefs: Record<string, number>,
    pricePrefs: any,
    userType: string
  ) {
    const topCategories = Object.entries(categoryPrefs)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category)

    const nextPurchaseProbability = this.calculatePurchaseProbability(
      userType,
      categoryPrefs
    )
    const optimalPriceRange = this.calculateOptimalPriceRange(
      pricePrefs,
      userType
    )

    return {
      nextPurchaseProbability,
      preferredCategories: topCategories,
      optimalPriceRange,
      bestEngagementTime: 'evening', // Would be calculated from timing data
    }
  }

  // Calculate purchase probability
  private calculatePurchaseProbability(
    userType: string,
    categoryPrefs: Record<string, number>
  ): number {
    const baseProbabilities = {
      buyer: 0.7,
      collector: 0.5,
      browser: 0.3,
      casual: 0.1,
    }

    const baseProb =
      baseProbabilities[userType as keyof typeof baseProbabilities] || 0.3
    const categoryBoost = Object.keys(categoryPrefs).length > 0 ? 0.1 : 0

    return Math.min(baseProb + categoryBoost, 1)
  }

  // Calculate optimal price range
  private calculateOptimalPriceRange(
    pricePrefs: any,
    userType: string
  ): { min: number; max: number } {
    const baseRange = { min: pricePrefs.min, max: pricePrefs.max }

    // Adjust based on user type
    switch (userType) {
      case 'buyer':
        return { min: baseRange.min * 0.8, max: baseRange.max * 1.2 }
      case 'collector':
        return { min: baseRange.min * 0.9, max: baseRange.max * 1.1 }
      case 'browser':
        return { min: baseRange.min * 0.7, max: baseRange.max * 0.9 }
      default:
        return baseRange
    }
  }

  // Analyze session behavior
  async analyzeSession(sessionId: string): Promise<SessionAnalysis | null> {
    try {
      // This would analyze a specific session
      // For now, return a placeholder structure
      return {
        sessionId,
        userId: 'unknown',
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        actions: [],
        metrics: {
          totalActions: 0,
          uniqueProducts: 0,
          categoriesViewed: [],
          priceRange: { min: 0, max: 0 },
          engagementScore: 0,
        },
      }
    } catch (error) {
      console.error('Error analyzing session:', error)
      return null
    }
  }

  // Perform cohort analysis
  async performCohortAnalysis(
    period: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ): Promise<CohortAnalysis[]> {
    try {
      // This would perform cohort analysis
      // For now, return placeholder data
      return [
        {
          cohort: '2024-01',
          period,
          metrics: {
            size: 100,
            retention: [1, 0.8, 0.6, 0.4],
            engagement: [0.7, 0.6, 0.5, 0.4],
            conversion: [0.1, 0.08, 0.06, 0.04],
            revenue: [1000, 800, 600, 400],
          },
          insights: {
            topPerformingCohorts: ['2024-01'],
            retentionDrivers: ['product quality', 'user experience'],
            engagementFactors: ['personalization', 'recommendations'],
          },
        },
      ]
    } catch (error) {
      console.error('Error performing cohort analysis:', error)
      return []
    }
  }

  // Get user segments
  async getUserSegments(): Promise<Record<string, number>> {
    try {
      const users = await prisma.user.findMany({
        include: {
          swipes: true,
        },
      })

      const segments: Record<string, number> = {
        browser: 0,
        buyer: 0,
        collector: 0,
        casual: 0,
      }

      users.forEach((user) => {
        const behavior = this.analyzeUserBehavior(user.id)
        if (behavior) {
          segments[behavior.segments.userType]++
        }
      })

      return segments
    } catch (error) {
      console.error('Error getting user segments:', error)
      return {}
    }
  }

  // Update user behavior model
  async updateBehaviorModel(userId: string, action: string, productId: string) {
    try {
      // This would update the user's behavior model
      // In a real implementation, this would:
      // 1. Update the user's preference weights
      // 2. Retrain the recommendation model
      // 3. Update user segments
      console.log(
        `Updating behavior model for user ${userId}, action ${action}, product ${productId}`
      )
    } catch (error) {
      console.error('Error updating behavior model:', error)
    }
  }
}

export {
  UserBehaviorAnalyzer,
  BehaviorPattern,
  SessionAnalysis,
  CohortAnalysis,
}

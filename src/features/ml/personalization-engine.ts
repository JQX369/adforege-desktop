import { PrismaClient } from '@prisma/client'
import { BehaviorPattern } from './user-behavior-analyzer'
import { NicheProfile } from './niche-detector'

const prisma = new PrismaClient()

// Personalization Engine
interface PersonalizationConfig {
  // Model weights
  collaborativeWeight: number
  contentWeight: number
  demographicWeight: number
  behavioralWeight: number
  contextualWeight: number

  // Learning parameters
  learningRate: number
  decayFactor: number
  minInteractions: number
  updateFrequency: number

  // Personalization features
  realTimePersonalization: boolean
  crossDomainPersonalization: boolean
  privacyPreservingPersonalization: boolean
}

const DEFAULT_PERSONALIZATION_CONFIG: PersonalizationConfig = {
  collaborativeWeight: 0.3,
  contentWeight: 0.25,
  demographicWeight: 0.15,
  behavioralWeight: 0.2,
  contextualWeight: 0.1,
  learningRate: 0.01,
  decayFactor: 0.95,
  minInteractions: 5,
  updateFrequency: 1000,
  realTimePersonalization: true,
  crossDomainPersonalization: false,
  privacyPreservingPersonalization: true,
}

// User Profile
interface UserProfile {
  userId: string
  demographics: {
    ageGroup: string
    gender: string
    location: string
    incomeLevel: string
    education: string
  }
  preferences: {
    categories: Record<string, number>
    brands: Record<string, number>
    priceRange: { min: number; max: number; preferred: number }
    occasions: Record<string, number>
    relationships: Record<string, number>
  }
  behavior: {
    browsingPatterns: Record<string, number>
    interactionPatterns: Record<string, number>
    timingPatterns: Record<string, number>
    devicePatterns: Record<string, number>
  }
  context: {
    currentSession: string
    recentSearches: string[]
    currentLocation: string
    currentTime: Date
    currentDevice: string
  }
  model: {
    weights: Record<string, number>
    lastUpdated: Date
    accuracy: number
    confidence: number
  }
}

// Personalization Result
interface PersonalizationResult {
  userId: string
  recommendations: Array<{
    productId: string
    score: number
    reasons: string[]
    confidence: number
  }>
  personalization: {
    level: 'low' | 'medium' | 'high'
    factors: string[]
    accuracy: number
    lastUpdated: Date
  }
  insights: {
    topCategories: string[]
    topBrands: string[]
    pricePreference: { min: number; max: number }
    bestTimeToEngage: string
    predictedBehavior: string
  }
}

class PersonalizationEngine {
  private config: PersonalizationConfig
  private userProfiles: Map<string, UserProfile> = new Map()
  private modelCache: Map<string, any> = new Map()

  constructor(config: Partial<PersonalizationConfig> = {}) {
    this.config = { ...DEFAULT_PERSONALIZATION_CONFIG, ...config }
  }

  // Main personalization method
  async personalizeRecommendations(
    userId: string,
    candidateProducts: any[],
    context: any = {}
  ): Promise<PersonalizationResult> {
    try {
      // 1. Load or create user profile
      const userProfile = await this.loadUserProfile(userId)

      // 2. Update profile with current context
      const updatedProfile = this.updateProfileWithContext(userProfile, context)

      // 3. Apply personalization models
      const personalizedProducts = await this.applyPersonalizationModels(
        candidateProducts,
        updatedProfile
      )

      // 4. Generate insights
      const insights = this.generateInsights(updatedProfile)

      // 5. Calculate personalization level
      const personalizationLevel =
        this.calculatePersonalizationLevel(updatedProfile)

      return {
        userId,
        recommendations: personalizedProducts,
        personalization: {
          level: personalizationLevel,
          factors: this.getPersonalizationFactors(updatedProfile),
          accuracy: updatedProfile.model.accuracy,
          lastUpdated: updatedProfile.model.lastUpdated,
        },
        insights,
      }
    } catch (error) {
      console.error('Personalization error:', error)
      throw error
    }
  }

  // Load or create user profile
  private async loadUserProfile(userId: string): Promise<UserProfile> {
    // Check cache first
    if (this.userProfiles.has(userId)) {
      return this.userProfiles.get(userId)!
    }

    // Load from database
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

    if (!user) {
      // Create new profile
      const newProfile = this.createNewProfile(userId)
      this.userProfiles.set(userId, newProfile)
      return newProfile
    }

    // Build profile from user data
    const profile = await this.buildProfileFromUserData(user)
    this.userProfiles.set(userId, profile)
    return profile
  }

  // Create new user profile
  private createNewProfile(userId: string): UserProfile {
    return {
      userId,
      demographics: {
        ageGroup: 'unknown',
        gender: 'unknown',
        location: 'unknown',
        incomeLevel: 'unknown',
        education: 'unknown',
      },
      preferences: {
        categories: {},
        brands: {},
        priceRange: { min: 0, max: 1000, preferred: 50 },
        occasions: {},
        relationships: {},
      },
      behavior: {
        browsingPatterns: {},
        interactionPatterns: {},
        timingPatterns: {},
        devicePatterns: {},
      },
      context: {
        currentSession: '',
        recentSearches: [],
        currentLocation: '',
        currentTime: new Date(),
        currentDevice: '',
      },
      model: {
        weights: {
          collaborative: 0.3,
          content: 0.25,
          demographic: 0.15,
          behavioral: 0.2,
          contextual: 0.1,
        },
        lastUpdated: new Date(),
        accuracy: 0.5,
        confidence: 0.3,
      },
    }
  }

  // Build profile from user data
  private async buildProfileFromUserData(user: any): Promise<UserProfile> {
    const swipes = user.swipes || []
    const likes = swipes.filter((s: any) => s.action === 'LIKE')
    const dislikes = swipes.filter((s: any) => s.action === 'DISLIKE')
    const saves = swipes.filter((s: any) => s.action === 'SAVE')

    // Analyze preferences
    const preferences = this.analyzePreferences(likes, dislikes, saves)

    // Analyze behavior patterns
    const behavior = this.analyzeBehaviorPatterns(swipes)

    // Calculate model accuracy
    const accuracy = this.calculateModelAccuracy(swipes)

    return {
      userId: user.id,
      demographics: {
        ageGroup: 'unknown', // Would be inferred from behavior
        gender: 'unknown',
        location: 'unknown',
        incomeLevel: 'unknown',
        education: 'unknown',
      },
      preferences,
      behavior,
      context: {
        currentSession: '',
        recentSearches: [],
        currentLocation: '',
        currentTime: new Date(),
        currentDevice: '',
      },
      model: {
        weights: {
          collaborative: 0.3,
          content: 0.25,
          demographic: 0.15,
          behavioral: 0.2,
          contextual: 0.1,
        },
        lastUpdated: new Date(),
        accuracy,
        confidence: Math.min(accuracy + 0.2, 1),
      },
    }
  }

  // Analyze user preferences
  private analyzePreferences(likes: any[], dislikes: any[], saves: any[]): any {
    const preferences = {
      categories: {} as Record<string, number>,
      brands: {} as Record<string, number>,
      priceRange: { min: 0, max: 1000, preferred: 50 },
      occasions: {} as Record<string, number>,
      relationships: {} as Record<string, number>,
    }

    // Category preferences
    likes.forEach((swipe) => {
      const product = swipe.product
      if (product.categories) {
        product.categories.forEach((category: string) => {
          preferences.categories[category] =
            (preferences.categories[category] || 0) + 1
        })
      }
    })

    // Brand preferences
    likes.forEach((swipe) => {
      const brand = swipe.product.brand
      if (brand) {
        preferences.brands[brand] = (preferences.brands[brand] || 0) + 1
      }
    })

    // Price preferences
    const prices = likes.map((swipe) => swipe.product.price).filter(Boolean)
    if (prices.length > 0) {
      preferences.priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
        preferred: prices.reduce((a, b) => a + b, 0) / prices.length,
      }
    }

    return preferences
  }

  // Analyze behavior patterns
  private analyzeBehaviorPatterns(swipes: any[]): any {
    const behavior = {
      browsingPatterns: {} as Record<string, number>,
      interactionPatterns: {} as Record<string, number>,
      timingPatterns: {} as Record<string, number>,
      devicePatterns: {} as Record<string, number>,
    }

    // Interaction patterns
    const totalInteractions = swipes.length
    const likes = swipes.filter((s) => s.action === 'LIKE').length
    const saves = swipes.filter((s) => s.action === 'SAVE').length

    behavior.interactionPatterns = {
      clickRate: totalInteractions > 0 ? likes / totalInteractions : 0,
      saveRate: totalInteractions > 0 ? saves / totalInteractions : 0,
      engagementScore:
        totalInteractions > 0 ? (likes + saves) / totalInteractions : 0,
    }

    return behavior
  }

  // Calculate model accuracy
  private calculateModelAccuracy(swipes: any[]): number {
    if (swipes.length < this.config.minInteractions) return 0.5

    const likes = swipes.filter((s) => s.action === 'LIKE').length
    const total = swipes.length
    const accuracy = likes / total

    return Math.max(0.1, Math.min(0.9, accuracy))
  }

  // Update profile with current context
  private updateProfileWithContext(
    profile: UserProfile,
    context: any
  ): UserProfile {
    return {
      ...profile,
      context: {
        ...profile.context,
        ...context,
        currentTime: new Date(),
      },
    }
  }

  // Apply personalization models
  private async applyPersonalizationModels(
    candidateProducts: any[],
    userProfile: UserProfile
  ): Promise<
    Array<{
      productId: string
      score: number
      reasons: string[]
      confidence: number
    }>
  > {
    const personalized = candidateProducts.map((product) => {
      let score = 0
      const reasons: string[] = []
      let confidence = 0.5

      // Collaborative filtering score
      const collaborativeScore = this.calculateCollaborativeScore(
        product,
        userProfile
      )
      score += collaborativeScore * this.config.collaborativeWeight
      if (collaborativeScore > 0.7) reasons.push('Similar users liked this')

      // Content-based score
      const contentScore = this.calculateContentScore(product, userProfile)
      score += contentScore * this.config.contentWeight
      if (contentScore > 0.7) reasons.push('Matches your interests')

      // Demographic score
      const demographicScore = this.calculateDemographicScore(
        product,
        userProfile
      )
      score += demographicScore * this.config.demographicWeight
      if (demographicScore > 0.7) reasons.push('Popular in your demographic')

      // Behavioral score
      const behavioralScore = this.calculateBehavioralScore(
        product,
        userProfile
      )
      score += behavioralScore * this.config.behavioralWeight
      if (behavioralScore > 0.7) reasons.push('Matches your behavior patterns')

      // Contextual score
      const contextualScore = this.calculateContextualScore(
        product,
        userProfile
      )
      score += contextualScore * this.config.contextualWeight
      if (contextualScore > 0.7) reasons.push('Good for current context')

      // Calculate confidence
      confidence = this.calculateConfidence(userProfile, reasons.length)

      return {
        productId: product.id,
        score: Math.min(score, 1),
        reasons,
        confidence,
      }
    })

    return personalized.sort((a, b) => b.score - a.score)
  }

  // Calculate collaborative filtering score
  private calculateCollaborativeScore(
    product: any,
    userProfile: UserProfile
  ): number {
    // Simplified collaborative filtering
    // In a real implementation, this would use user-item interaction matrix
    const baseScore = (product.popularityScore || 0) / 100
    const qualityScore = (product.qualityScore || 0) / 100

    return (baseScore + qualityScore) / 2
  }

  // Calculate content-based score
  private calculateContentScore(
    product: any,
    userProfile: UserProfile
  ): number {
    let score = 0

    // Category matching
    const userCategories = Object.keys(userProfile.preferences.categories)
    const productCategories = product.categories || []
    const categoryMatches = productCategories.filter((cat) =>
      userCategories.includes(cat)
    ).length
    const categoryScore =
      productCategories.length > 0
        ? categoryMatches / productCategories.length
        : 0
    score += categoryScore * 0.4

    // Price matching
    const { min, max, preferred } = userProfile.preferences.priceRange
    const priceScore =
      product.price >= min && product.price <= max
        ? 1 - Math.abs(product.price - preferred) / (max - min)
        : 0
    score += priceScore * 0.3

    // Brand matching
    const brandScore =
      product.brand && userProfile.preferences.brands[product.brand]
        ? Math.min(userProfile.preferences.brands[product.brand] / 10, 1)
        : 0
    score += brandScore * 0.3

    return Math.min(score, 1)
  }

  // Calculate demographic score
  private calculateDemographicScore(
    product: any,
    userProfile: UserProfile
  ): number {
    // Simplified demographic scoring
    // In a real implementation, this would use demographic data
    return 0.5
  }

  // Calculate behavioral score
  private calculateBehavioralScore(
    product: any,
    userProfile: UserProfile
  ): number {
    const behavior = userProfile.behavior.interactionPatterns
    let score = 0

    // Click rate influence
    score += behavior.clickRate * 0.4

    // Save rate influence
    score += behavior.saveRate * 0.3

    // Engagement score influence
    score += behavior.engagementScore * 0.3

    return Math.min(score, 1)
  }

  // Calculate contextual score
  private calculateContextualScore(
    product: any,
    userProfile: UserProfile
  ): number {
    // Simplified contextual scoring
    // In a real implementation, this would use current context
    return 0.5
  }

  // Calculate confidence
  private calculateConfidence(
    userProfile: UserProfile,
    reasonCount: number
  ): number {
    const baseConfidence = userProfile.model.confidence
    const reasonBoost = Math.min(reasonCount * 0.1, 0.3)

    return Math.min(baseConfidence + reasonBoost, 1)
  }

  // Generate insights
  private generateInsights(userProfile: UserProfile): any {
    const topCategories = Object.entries(userProfile.preferences.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category)

    const topBrands = Object.entries(userProfile.preferences.brands)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([brand]) => brand)

    return {
      topCategories,
      topBrands,
      pricePreference: userProfile.preferences.priceRange,
      bestTimeToEngage: 'evening', // Would be calculated from timing patterns
      predictedBehavior: 'browser', // Would be predicted from behavior patterns
    }
  }

  // Calculate personalization level
  private calculatePersonalizationLevel(
    userProfile: UserProfile
  ): 'low' | 'medium' | 'high' {
    const interactions = Object.values(
      userProfile.preferences.categories
    ).reduce((a, b) => a + b, 0)
    const accuracy = userProfile.model.accuracy
    const confidence = userProfile.model.confidence

    const score = (interactions * 0.4 + accuracy * 0.3 + confidence * 0.3) / 100

    if (score > 0.7) return 'high'
    if (score > 0.4) return 'medium'
    return 'low'
  }

  // Get personalization factors
  private getPersonalizationFactors(userProfile: UserProfile): string[] {
    const factors: string[] = []

    if (Object.keys(userProfile.preferences.categories).length > 0) {
      factors.push('category preferences')
    }

    if (Object.keys(userProfile.preferences.brands).length > 0) {
      factors.push('brand preferences')
    }

    if (
      userProfile.preferences.priceRange.min > 0 ||
      userProfile.preferences.priceRange.max < 1000
    ) {
      factors.push('price preferences')
    }

    if (userProfile.behavior.interactionPatterns.engagementScore > 0.5) {
      factors.push('behavior patterns')
    }

    return factors
  }

  // Update user profile with new interaction
  async updateUserProfile(
    userId: string,
    productId: string,
    action: string
  ): Promise<void> {
    try {
      const profile = await this.loadUserProfile(userId)

      // Update preferences based on action
      if (action === 'LIKE' || action === 'SAVE') {
        // Positive feedback - strengthen preferences
        await this.strengthenPreferences(profile, productId)
      } else if (action === 'DISLIKE') {
        // Negative feedback - weaken preferences
        await this.weakenPreferences(profile, productId)
      }

      // Update model weights
      this.updateModelWeights(profile, action)

      // Update cache
      this.userProfiles.set(userId, profile)

      console.log(`Updated profile for user ${userId}, action ${action}`)
    } catch (error) {
      console.error('Error updating user profile:', error)
    }
  }

  // Strengthen preferences
  private async strengthenPreferences(
    profile: UserProfile,
    productId: string
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categories: true, brand: true, price: true },
    })

    if (!product) return

    // Strengthen category preferences
    if (product.categories) {
      product.categories.forEach((category) => {
        profile.preferences.categories[category] =
          (profile.preferences.categories[category] || 0) + 1
      })
    }

    // Strengthen brand preferences
    if (product.brand) {
      profile.preferences.brands[product.brand] =
        (profile.preferences.brands[product.brand] || 0) + 1
    }

    // Update price preferences
    const currentPrice = product.price
    const { min, max, preferred } = profile.preferences.priceRange

    profile.preferences.priceRange = {
      min: Math.min(min, currentPrice),
      max: Math.max(max, currentPrice),
      preferred: (preferred + currentPrice) / 2,
    }
  }

  // Weaken preferences
  private async weakenPreferences(
    profile: UserProfile,
    productId: string
  ): Promise<void> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { categories: true, brand: true },
    })

    if (!product) return

    // Weaken category preferences
    if (product.categories) {
      product.categories.forEach((category) => {
        if (profile.preferences.categories[category]) {
          profile.preferences.categories[category] = Math.max(
            0,
            profile.preferences.categories[category] - 0.5
          )
        }
      })
    }

    // Weaken brand preferences
    if (product.brand && profile.preferences.brands[product.brand]) {
      profile.preferences.brands[product.brand] = Math.max(
        0,
        profile.preferences.brands[product.brand] - 0.5
      )
    }
  }

  // Update model weights
  private updateModelWeights(profile: UserProfile, action: string): void {
    // Adjust weights based on action success
    const adjustment = action === 'LIKE' || action === 'SAVE' ? 0.01 : -0.01

    profile.model.weights.collaborative += adjustment
    profile.model.weights.content += adjustment
    profile.model.weights.behavioral += adjustment

    // Normalize weights
    const total = Object.values(profile.model.weights).reduce(
      (a, b) => a + b,
      0
    )
    Object.keys(profile.model.weights).forEach((key) => {
      profile.model.weights[key] /= total
    })

    profile.model.lastUpdated = new Date()
  }

  // Get personalization insights
  async getPersonalizationInsights(userId: string): Promise<any> {
    const profile = await this.loadUserProfile(userId)

    return {
      profile,
      insights: {
        personalizationLevel: this.calculatePersonalizationLevel(profile),
        topCategories: Object.keys(profile.preferences.categories).slice(0, 5),
        topBrands: Object.keys(profile.preferences.brands).slice(0, 5),
        pricePreference: profile.preferences.priceRange,
        modelAccuracy: profile.model.accuracy,
        lastUpdated: profile.model.lastUpdated,
      },
    }
  }
}

export {
  PersonalizationEngine,
  PersonalizationConfig,
  UserProfile,
  PersonalizationResult,
}

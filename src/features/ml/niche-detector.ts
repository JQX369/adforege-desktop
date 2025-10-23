import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Niche Detection and Analysis
interface NicheProfile {
  id: string
  name: string
  description: string
  keywords: string[]
  categories: string[]
  subcategories: string[]
  demographics: {
    ageGroups: string[]
    genders: string[]
    locations: string[]
    incomeLevels: string[]
  }
  behavior: {
    avgClickRate: number
    avgSaveRate: number
    avgPurchaseRate: number
    avgSessionDuration: number
    bounceRate: number
  }
  products: {
    count: number
    avgPrice: number
    priceRange: { min: number; max: number }
    topBrands: string[]
    topRetailers: string[]
  }
  trends: {
    growthRate: number
    seasonality: Record<string, number>
    peakMonths: string[]
    decliningMonths: string[]
  }
  opportunities: {
    underservedCategories: string[]
    priceGaps: Array<{ range: string; opportunity: number }>
    geographicGaps: string[]
    demographicGaps: string[]
  }
  competitors: {
    directCompetitors: string[]
    indirectCompetitors: string[]
    marketShare: number
  }
}

// Niche Detection Algorithm
interface NicheDetectionConfig {
  minProducts: number
  minUsers: number
  similarityThreshold: number
  growthThreshold: number
  diversityThreshold: number
}

const DEFAULT_NICHE_CONFIG: NicheDetectionConfig = {
  minProducts: 50,
  minUsers: 100,
  similarityThreshold: 0.7,
  growthThreshold: 0.1,
  diversityThreshold: 0.3,
}

// Product Clustering
interface ProductCluster {
  id: string
  centroid: number[]
  products: string[]
  characteristics: {
    categories: string[]
    avgPrice: number
    priceRange: { min: number; max: number }
    avgRating: number
    topFeatures: string[]
  }
  niche: string
  confidence: number
}

class NicheDetector {
  private config: NicheDetectionConfig
  private nicheProfiles: Map<string, NicheProfile> = new Map()

  constructor(config: Partial<NicheDetectionConfig> = {}) {
    this.config = { ...DEFAULT_NICHE_CONFIG, ...config }
  }

  // Main niche detection method
  async detectNiches(): Promise<NicheProfile[]> {
    try {
      console.log('🔍 Starting niche detection...')

      // 1. Get product data
      const products = await this.getProductData()

      // 2. Cluster products by similarity
      const clusters = await this.clusterProducts(products)

      // 3. Analyze clusters for niche potential
      const nicheCandidates = await this.analyzeClusters(clusters)

      // 4. Build niche profiles
      const niches = await this.buildNicheProfiles(nicheCandidates)

      // 5. Identify opportunities
      const nichesWithOpportunities = await this.identifyOpportunities(niches)

      console.log(`✅ Detected ${nichesWithOpportunities.length} niches`)
      return nichesWithOpportunities
    } catch (error) {
      console.error('Error detecting niches:', error)
      return []
    }
  }

  // Get product data for analysis
  private async getProductData() {
    const products = await prisma.product.findMany({
      where: {
        status: 'APPROVED',
        inStock: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        categories: true,
        price: true,
        rating: true,
        brand: true,
        retailer: true,
        features: true,
        embedding: true,
        qualityScore: true,
        popularityScore: true,
        recencyScore: true,
      },
    })

    return products
  }

  // Cluster products using similarity
  private async clusterProducts(products: any[]): Promise<ProductCluster[]> {
    const clusters: ProductCluster[] = []
    const processed = new Set<string>()

    for (const product of products) {
      if (processed.has(product.id)) continue

      const cluster: ProductCluster = {
        id: `cluster_${clusters.length}`,
        centroid: product.embedding || [],
        products: [product.id],
        characteristics: {
          categories: product.categories || [],
          avgPrice: product.price,
          priceRange: { min: product.price, max: product.price },
          avgRating: product.rating || 0,
          topFeatures: product.features || [],
        },
        niche: '',
        confidence: 0,
      }

      // Find similar products
      for (const otherProduct of products) {
        if (otherProduct.id === product.id || processed.has(otherProduct.id))
          continue

        const similarity = this.calculateSimilarity(product, otherProduct)
        if (similarity > this.config.similarityThreshold) {
          cluster.products.push(otherProduct.id)
          processed.add(otherProduct.id)

          // Update cluster characteristics
          cluster.characteristics.avgPrice =
            (cluster.characteristics.avgPrice * (cluster.products.length - 1) +
              otherProduct.price) /
            cluster.products.length

          cluster.characteristics.priceRange.min = Math.min(
            cluster.characteristics.priceRange.min,
            otherProduct.price
          )
          cluster.characteristics.priceRange.max = Math.max(
            cluster.characteristics.priceRange.max,
            otherProduct.price
          )

          if (otherProduct.rating) {
            cluster.characteristics.avgRating =
              (cluster.characteristics.avgRating *
                (cluster.products.length - 1) +
                otherProduct.rating) /
              cluster.products.length
          }
        }
      }

      if (cluster.products.length >= this.config.minProducts) {
        clusters.push(cluster)
      }

      processed.add(product.id)
    }

    return clusters
  }

  // Calculate similarity between products
  private calculateSimilarity(product1: any, product2: any): number {
    let similarity = 0

    // Category similarity
    const categories1 = new Set(product1.categories || [])
    const categories2 = new Set(product2.categories || [])
    const categoryIntersection = new Set(
      [...categories1].filter((x) => categories2.has(x))
    )
    const categoryUnion = new Set([...categories1, ...categories2])
    const categorySimilarity =
      categoryUnion.size > 0
        ? categoryIntersection.size / categoryUnion.size
        : 0

    similarity += categorySimilarity * 0.4

    // Price similarity
    const priceDiff = Math.abs(product1.price - product2.price)
    const maxPrice = Math.max(product1.price, product2.price)
    const priceSimilarity = maxPrice > 0 ? 1 - priceDiff / maxPrice : 0

    similarity += priceSimilarity * 0.2

    // Brand similarity
    const brandSimilarity = product1.brand === product2.brand ? 1 : 0
    similarity += brandSimilarity * 0.2

    // Feature similarity
    const features1 = new Set(product1.features || [])
    const features2 = new Set(product2.features || [])
    const featureIntersection = new Set(
      [...features1].filter((x) => features2.has(x))
    )
    const featureUnion = new Set([...features1, ...features2])
    const featureSimilarity =
      featureUnion.size > 0 ? featureIntersection.size / featureUnion.size : 0

    similarity += featureSimilarity * 0.2

    return similarity
  }

  // Analyze clusters for niche potential
  private async analyzeClusters(
    clusters: ProductCluster[]
  ): Promise<ProductCluster[]> {
    const nicheCandidates: ProductCluster[] = []

    for (const cluster of clusters) {
      // Check if cluster has enough products
      if (cluster.products.length < this.config.minProducts) continue

      // Analyze cluster characteristics
      const nichePotential = await this.analyzeNichePotential(cluster)

      if (nichePotential > 0.5) {
        cluster.confidence = nichePotential
        cluster.niche = this.generateNicheName(cluster)
        nicheCandidates.push(cluster)
      }
    }

    return nicheCandidates.sort((a, b) => b.confidence - a.confidence)
  }

  // Analyze niche potential
  private async analyzeNichePotential(
    cluster: ProductCluster
  ): Promise<number> {
    let potential = 0

    // Product diversity
    const categoryDiversity = new Set(cluster.characteristics.categories).size
    const diversityScore = Math.min(categoryDiversity / 10, 1)
    potential += diversityScore * 0.3

    // Price range
    const priceRange =
      cluster.characteristics.priceRange.max -
      cluster.characteristics.priceRange.min
    const priceScore = priceRange > 0 ? Math.min(priceRange / 1000, 1) : 0
    potential += priceScore * 0.2

    // Quality score
    const qualityScore = cluster.characteristics.avgRating / 5
    potential += qualityScore * 0.2

    // Growth potential (placeholder)
    const growthScore = 0.5 // Would be calculated from historical data
    potential += growthScore * 0.3

    return potential
  }

  // Generate niche name
  private generateNicheName(cluster: ProductCluster): string {
    const topCategories = cluster.characteristics.categories.slice(0, 2)
    const priceRange = cluster.characteristics.priceRange

    let name = topCategories.join(' & ')

    if (priceRange.max < 50) {
      name += ' (Budget)'
    } else if (priceRange.min > 200) {
      name += ' (Premium)'
    } else {
      name += ' (Mid-range)'
    }

    return name
  }

  // Build niche profiles
  private async buildNicheProfiles(
    clusters: ProductCluster[]
  ): Promise<NicheProfile[]> {
    const niches: NicheProfile[] = []

    for (const cluster of clusters) {
      const niche: NicheProfile = {
        id: cluster.id,
        name: cluster.niche,
        description: `A niche focused on ${cluster.characteristics.categories.join(', ')} products`,
        keywords: this.extractKeywords(cluster),
        categories: cluster.characteristics.categories,
        subcategories: [],
        demographics: {
          ageGroups: ['18-34', '35-54'], // Would be calculated from user data
          genders: ['all'],
          locations: ['global'],
          incomeLevels: ['middle'],
        },
        behavior: {
          avgClickRate: 0.1,
          avgSaveRate: 0.05,
          avgPurchaseRate: 0.02,
          avgSessionDuration: 300,
          bounceRate: 0.3,
        },
        products: {
          count: cluster.products.length,
          avgPrice: cluster.characteristics.avgPrice,
          priceRange: cluster.characteristics.priceRange,
          topBrands: [], // Would be calculated from product data
          topRetailers: [], // Would be calculated from product data
        },
        trends: {
          growthRate: 0.1,
          seasonality: {},
          peakMonths: [],
          decliningMonths: [],
        },
        opportunities: {
          underservedCategories: [],
          priceGaps: [],
          geographicGaps: [],
          demographicGaps: [],
        },
        competitors: {
          directCompetitors: [],
          indirectCompetitors: [],
          marketShare: 0,
        },
      }

      niches.push(niche)
    }

    return niches
  }

  // Extract keywords from cluster
  private extractKeywords(cluster: ProductCluster): string[] {
    const keywords = [...cluster.characteristics.categories]

    // Add price-based keywords
    if (cluster.characteristics.priceRange.max < 50) {
      keywords.push('budget', 'affordable', 'cheap')
    } else if (cluster.characteristics.priceRange.min > 200) {
      keywords.push('premium', 'luxury', 'high-end')
    }

    // Add feature-based keywords
    keywords.push(...cluster.characteristics.topFeatures.slice(0, 5))

    return keywords
  }

  // Identify opportunities within niches
  private async identifyOpportunities(
    niches: NicheProfile[]
  ): Promise<NicheProfile[]> {
    for (const niche of niches) {
      // Identify underserved categories
      niche.opportunities.underservedCategories =
        await this.findUnderservedCategories(niche)

      // Identify price gaps
      niche.opportunities.priceGaps = await this.findPriceGaps(niche)

      // Identify geographic gaps
      niche.opportunities.geographicGaps = await this.findGeographicGaps(niche)

      // Identify demographic gaps
      niche.opportunities.demographicGaps =
        await this.findDemographicGaps(niche)
    }

    return niches
  }

  // Find underserved categories
  private async findUnderservedCategories(
    niche: NicheProfile
  ): Promise<string[]> {
    // This would analyze category coverage within the niche
    // For now, return placeholder data
    return ['subcategory1', 'subcategory2']
  }

  // Find price gaps
  private async findPriceGaps(
    niche: NicheProfile
  ): Promise<Array<{ range: string; opportunity: number }>> {
    const gaps = []
    const { min, max } = niche.products.priceRange
    const range = max - min

    if (range > 100) {
      gaps.push({
        range: `${min}-${min + range * 0.3}`,
        opportunity: 0.7,
      })
      gaps.push({
        range: `${max - range * 0.3}-${max}`,
        opportunity: 0.5,
      })
    }

    return gaps
  }

  // Find geographic gaps
  private async findGeographicGaps(niche: NicheProfile): Promise<string[]> {
    // This would analyze geographic coverage
    return ['region1', 'region2']
  }

  // Find demographic gaps
  private async findDemographicGaps(niche: NicheProfile): Promise<string[]> {
    // This would analyze demographic coverage
    return ['age-group1', 'gender-group1']
  }

  // Get niche recommendations for a user
  async getNicheRecommendations(
    userId: string,
    limit: number = 5
  ): Promise<NicheProfile[]> {
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

      if (!user) return []

      // Analyze user preferences
      const userPreferences = await this.analyzeUserPreferences(user)

      // Match niches to user preferences
      const niches = Array.from(this.nicheProfiles.values())
      const matchedNiches = niches
        .map((niche) => ({
          ...niche,
          matchScore: this.calculateNicheMatch(niche, userPreferences),
        }))
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit)

      return matchedNiches
    } catch (error) {
      console.error('Error getting niche recommendations:', error)
      return []
    }
  }

  // Analyze user preferences
  private async analyzeUserPreferences(user: any): Promise<any> {
    const swipes = user.swipes || []
    const likes = swipes.filter((s: any) => s.action === 'LIKE')

    const preferences = {
      categories: new Set<string>(),
      priceRange: { min: 0, max: 1000 },
      brands: new Set<string>(),
    }

    likes.forEach((swipe: any) => {
      const product = swipe.product
      if (product.categories) {
        product.categories.forEach((category: string) => {
          preferences.categories.add(category)
        })
      }
      if (product.brand) {
        preferences.brands.add(product.brand)
      }
    })

    return preferences
  }

  // Calculate niche match score
  private calculateNicheMatch(
    niche: NicheProfile,
    userPreferences: any
  ): number {
    let score = 0

    // Category match
    const userCategories = Array.from(userPreferences.categories)
    const categoryMatches = niche.categories.filter((cat) =>
      userCategories.includes(cat)
    ).length
    const categoryScore =
      niche.categories.length > 0
        ? categoryMatches / niche.categories.length
        : 0
    score += categoryScore * 0.6

    // Price match
    const userPriceRange = userPreferences.priceRange
    const priceOverlap = this.calculatePriceOverlap(
      niche.products.priceRange,
      userPriceRange
    )
    score += priceOverlap * 0.4

    return score
  }

  // Calculate price overlap
  private calculatePriceOverlap(range1: any, range2: any): number {
    const overlap = Math.max(
      0,
      Math.min(range1.max, range2.max) - Math.max(range1.min, range2.min)
    )
    const union =
      Math.max(range1.max, range2.max) - Math.min(range1.min, range2.min)
    return union > 0 ? overlap / union : 0
  }

  // Update niche profiles
  async updateNicheProfiles(): Promise<void> {
    try {
      const niches = await this.detectNiches()

      // Update cache
      this.nicheProfiles.clear()
      niches.forEach((niche) => {
        this.nicheProfiles.set(niche.id, niche)
      })

      console.log(`✅ Updated ${niches.length} niche profiles`)
    } catch (error) {
      console.error('Error updating niche profiles:', error)
    }
  }

  // Get niche insights
  async getNicheInsights(nicheId: string): Promise<any> {
    const niche = this.nicheProfiles.get(nicheId)
    if (!niche) return null

    return {
      niche,
      insights: {
        marketSize: niche.products.count * 1000, // Placeholder
        growthPotential: niche.trends.growthRate,
        competitionLevel: 'medium', // Would be calculated
        recommendationScore: niche.confidence || 0.5,
      },
    }
  }
}

export { NicheDetector, NicheProfile, ProductCluster, NicheDetectionConfig }

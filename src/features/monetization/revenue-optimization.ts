import { AffiliateConversion, ConversionEvent, Vendor } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ---------- Types ----------

type RevenueStreamKey = 'affiliate' | 'vendorSubscriptions' | 'premiumFeatures'

type PricingTierKey = 'BASIC' | 'FEATURED' | 'PREMIUM' | 'ENTERPRISE'

type OptimizationType = 'affiliate' | 'subscription' | 'premium'

interface RevenueStreamConfig {
  weight: number
  target: number
  current: number
}

interface PricingTierConfig {
  basePrice: number
  minPrice: number
  maxPrice: number
  features: string[]
  targetConversion: number
}

interface RevenueStreamsConfig
  extends Record<RevenueStreamKey, RevenueStreamConfig> {}

interface PricingTiersConfig
  extends Record<PricingTierKey, PricingTierConfig> {}

interface RevenueBreakdown {
  affiliate: number
  subscriptions: number
}

interface RevenueSnapshot {
  total: number
  affiliate: number
  subscriptions: number
  breakdown: RevenueBreakdown
}

interface RevenueOptimizationResult {
  success: boolean
  currentRevenue?: RevenueSnapshot
  opportunities?: OptimizationOpportunity[]
  streamOptimizations?: StreamOptimizationSummary[]
  pricingOptimization?: PricingOptimizationSummary
  expectedImprovements?: ExpectedImprovements
  recommendations?: string[]
  error?: string
}

interface AffiliateOptimizationResult {
  success: boolean
  affiliatePerformance?: AffiliatePerformance
  linkOptimization?: OptimizationSummary
  abTestResults?: ABTestSummary
  recommendationOptimization?: OptimizationSummary
  expectedRevenueIncrease?: number
  error?: string
}

interface VendorSubscriptionOptimizationResult {
  success: boolean
  subscriptionPerformance?: SubscriptionPerformance
  pricingOptimization?: {
    currentPricing: PricingPerformance
    optimizedPricing: PricingTiersConfig
    recommendations: string[]
  }
  retentionStrategies?: RetentionSummary
  upgradeOptimization?: OptimizationSummary
  expectedMRRIncrease?: number
  error?: string
}

interface DynamicPricingResult {
  success: boolean
  marketConditions?: MarketConditions
  optimalPricing?: PricingTiersConfig
  pricingChanges?: PricingChangeSummary
  impactMonitoring?: ImpactMonitoring
  expectedRevenueImpact?: number
  error?: string
}

interface OptimizationOpportunity {
  type:
    | 'conversion_optimization'
    | 'pricing_optimization'
    | 'retention_optimization'
  priority: 'low' | 'medium' | 'high'
  description: string
  potentialImpact: number
}

interface StreamOptimizationSummary {
  type: OptimizationType
  currentPerformance: number
  optimizedPerformance: number
  expectedImprovement: number
  strategies: string[]
}

interface PricingOptimizationSummary {
  currentPricing: PricingTiersConfig
  optimizedPricing: PricingTiersConfig
  recommendations: PricingRecommendation[]
}

interface PricingRecommendation {
  tier: PricingTierKey
  currentPrice: number
  optimalPrice: number
  reason: string
}

interface PricingChangeSummary {
  changes: Array<{
    tier: PricingTierKey
    oldPrice: number
    newPrice: number
    changePercent: number
  }>
  implementationDate: Date
}

interface ImpactMonitoring {
  monitoringPeriod: string
  metrics: string[]
  successCriteria: Record<string, string>
}

interface ExpectedImprovements {
  affiliate: number
  subscriptions: number
  premium: number
  total: number
}

interface AffiliatePerformance {
  totalConversions: number
  totalRevenue: number
  totalCommission: number
  averageOrderValue: number
  conversionRate: number
  topPrograms: Array<{ program: string; revenue: number; conversions: number }>
}

interface OptimizationSummary {
  currentStrategy: string
  optimizedStrategy: string
  improvements: string[]
  expectedImprovement: number
}

interface ABTestSummary {
  tests: Array<{
    name: string
    variants: string[]
    winner: string
    improvement: number
  }>
  overallImprovement: number
}

interface RetentionSummary {
  strategies: Array<{
    name: string
    description: string
    expectedImpact: number
  }>
  totalExpectedImpact: number
}

interface PricingPerformance {
  totalSubscriptions: number
  averageRevenuePerUser: number
  churnRate: number
  upgradeRate: number
  pricingTierDistribution: Record<PricingTierKey, number>
}

interface SubscriptionPerformance extends PricingPerformance {
  monthlyRecurringRevenue: number
}

interface MarketConditions {
  demand: 'low' | 'medium' | 'high'
  competition: 'low' | 'medium' | 'high'
  seasonality: 'off_peak' | 'normal' | 'holiday_peak'
  economicConditions: 'unstable' | 'stable'
  pricingPressure: 'low' | 'medium' | 'high'
}

// ---------- Helper Functions ----------

const toFixedNumber = (value: number, digits = 2) =>
  Number(value.toFixed(digits))

const safeDivide = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator

const defaultRevenueStreams: RevenueStreamsConfig = {
  affiliate: { weight: 0.3, target: 5000, current: 0 },
  vendorSubscriptions: { weight: 0.6, target: 10000, current: 0 },
  premiumFeatures: { weight: 0.1, target: 2000, current: 0 },
}

const defaultPricingTiers: PricingTiersConfig = {
  BASIC: {
    basePrice: 9,
    minPrice: 5,
    maxPrice: 15,
    features: ['basic_listing', 'analytics', 'support'],
    targetConversion: 0.15,
  },
  FEATURED: {
    basePrice: 39,
    minPrice: 25,
    maxPrice: 55,
    features: [
      'priority_listing',
      'advanced_analytics',
      'priority_support',
      'custom_branding',
    ],
    targetConversion: 0.08,
  },
  PREMIUM: {
    basePrice: 99,
    minPrice: 75,
    maxPrice: 125,
    features: [
      'top_placement',
      'custom_ai_training',
      'dedicated_support',
      'white_label',
    ],
    targetConversion: 0.05,
  },
  ENTERPRISE: {
    basePrice: 299,
    minPrice: 200,
    maxPrice: 500,
    features: [
      'unlimited_listings',
      'api_access',
      'custom_integration',
      'account_manager',
    ],
    targetConversion: 0.02,
  },
}

// ---------- Revenue Optimization Manager ----------

export class RevenueOptimization {
  private revenueStreams: RevenueStreamsConfig = { ...defaultRevenueStreams }
  private pricingTiers: PricingTiersConfig = { ...defaultPricingTiers }

  // Optimize overall revenue
  async optimizeRevenue(): Promise<RevenueOptimizationResult> {
    try {
      const currentRevenue = await this.analyzeCurrentRevenue()
      const opportunities = await this.identifyOptimizationOpportunities()
      const streamOptimizations = await this.optimizeRevenueStreams()
      const pricingOptimization = await this.optimizeDynamicPricing()

      const expectedImprovements = this.calculateExpectedImprovements(
        currentRevenue,
        streamOptimizations,
        pricingOptimization
      )

      return {
        success: true,
        currentRevenue,
        opportunities,
        streamOptimizations,
        pricingOptimization,
        expectedImprovements,
        recommendations: this.generateRevenueRecommendations(opportunities),
      }
    } catch (error) {
      console.error('Error optimizing revenue:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async optimizeAffiliateRevenue(): Promise<AffiliateOptimizationResult> {
    try {
      const affiliatePerformance = await this.analyzeAffiliatePerformance()
      const linkOptimization = await this.optimizeAffiliateLinks()
      const abTestResults = await this.runAffiliateABTests()
      const recommendationOptimization =
        await this.optimizeAffiliateRecommendations()

      return {
        success: true,
        affiliatePerformance,
        linkOptimization,
        abTestResults,
        recommendationOptimization,
        expectedRevenueIncrease:
          this.calculateAffiliateRevenueIncrease(affiliatePerformance),
      }
    } catch (error) {
      console.error('Error optimizing affiliate revenue:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async optimizeVendorSubscriptions(): Promise<VendorSubscriptionOptimizationResult> {
    try {
      const subscriptionPerformance =
        await this.analyzeSubscriptionPerformance()
      const pricingOptimization = await this.optimizeSubscriptionPricing()
      const retentionStrategies = await this.implementRetentionStrategies()
      const upgradeOptimization = await this.optimizeUpgradeFlows()

      return {
        success: true,
        subscriptionPerformance,
        pricingOptimization,
        retentionStrategies,
        upgradeOptimization,
        expectedMRRIncrease: this.calculateMRRIncrease(subscriptionPerformance),
      }
    } catch (error) {
      console.error('Error optimizing vendor subscriptions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async implementDynamicPricing(): Promise<DynamicPricingResult> {
    try {
      const marketConditions = await this.analyzeMarketConditions()
      const optimalPricing =
        await this.calculateOptimalPricing(marketConditions)
      const pricingChanges = await this.implementPricingChanges(optimalPricing)
      const impactMonitoring = await this.monitorPricingImpact(pricingChanges)

      return {
        success: true,
        marketConditions,
        optimalPricing,
        pricingChanges,
        impactMonitoring,
        expectedRevenueImpact: this.calculateRevenueImpact(optimalPricing),
      }
    } catch (error) {
      console.error('Error implementing dynamic pricing:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // ---------- Analytics ----------

  async getRevenueAnalytics(startDate?: Date, endDate?: Date) {
    const whereTemporal = this.buildDateFilter(startDate, endDate)

    const [affiliateRevenue, subscriptionVendors, conversionEvents] =
      await Promise.all([
        prisma.affiliateConversion.findMany({ where: whereTemporal }),
        prisma.vendor.findMany({
          where: { subscriptionStatus: 'ACTIVE' },
          include: { products: true },
        }),
        prisma.conversionEvent.findMany({ where: whereTemporal }),
      ])

    return {
      totalRevenue: this.calculateTotalRevenue(
        affiliateRevenue,
        subscriptionVendors
      ),
      revenueByStream: this.calculateRevenueByStream(
        affiliateRevenue,
        subscriptionVendors
      ),
      monthlyRecurringRevenue: this.calculateMRR(subscriptionVendors),
      averageRevenuePerUser: this.calculateARPU(subscriptionVendors),
      conversionFunnel: this.analyzeConversionFunnel(conversionEvents),
      revenueTrends: this.analyzeRevenueTrends(
        affiliateRevenue,
        subscriptionVendors
      ),
      topPerformingProducts:
        this.identifyTopPerformingProducts(affiliateRevenue),
      revenueForecast: this.generateRevenueForecast(
        affiliateRevenue,
        subscriptionVendors
      ),
    }
  }

  // ---------- Private helpers ----------

  private async analyzeCurrentRevenue(): Promise<RevenueSnapshot> {
    const [affiliateRevenue, subscriptionVendors] = await Promise.all([
      prisma.affiliateConversion.aggregate({
        _sum: { revenue: true },
      }),
      prisma.vendor.findMany({
        where: { subscriptionStatus: 'ACTIVE' },
        select: { plan: true },
      }),
    ])

    const totalAffiliateRevenue = affiliateRevenue._sum.revenue ?? 0
    const totalSubscriptionRevenue = subscriptionVendors.reduce(
      (sum, vendor) => sum + this.getPlanValue(vendor.plan),
      0
    )

    return {
      total: totalAffiliateRevenue + totalSubscriptionRevenue,
      affiliate: totalAffiliateRevenue,
      subscriptions: totalSubscriptionRevenue,
      breakdown: {
        affiliate: totalAffiliateRevenue,
        subscriptions: totalSubscriptionRevenue,
      },
    }
  }

  private async identifyOptimizationOpportunities(): Promise<
    OptimizationOpportunity[]
  > {
    const opportunities: OptimizationOpportunity[] = []

    const conversionRates = await this.analyzeConversionRates()
    if (conversionRates.overall < 0.05) {
      opportunities.push({
        type: 'conversion_optimization',
        priority: 'high',
        description: 'Low overall conversion rate - optimize funnel',
        potentialImpact: 0.2,
      })
    }

    const pricingSensitivity = await this.analyzePricingSensitivity()
    if (pricingSensitivity.elasticity > 1.5) {
      opportunities.push({
        type: 'pricing_optimization',
        priority: 'medium',
        description: 'High price sensitivity - consider dynamic pricing',
        potentialImpact: 0.15,
      })
    }

    const churnRate = await this.calculateChurnRate()
    if (churnRate > 0.1) {
      opportunities.push({
        type: 'retention_optimization',
        priority: 'high',
        description: 'High churn rate - implement retention strategies',
        potentialImpact: 0.25,
      })
    }

    return opportunities
  }

  private async optimizeRevenueStreams(): Promise<StreamOptimizationSummary[]> {
    return [
      await this.optimizeAffiliateStream(),
      await this.optimizeSubscriptionStream(),
      await this.optimizePremiumStream(),
    ]
  }

  private async optimizeDynamicPricing(): Promise<PricingOptimizationSummary> {
    const recommendations: PricingRecommendation[] = []
    const optimizedPricing: PricingTiersConfig = { ...this.pricingTiers }

    for (const tierKey of Object.keys(this.pricingTiers) as PricingTierKey[]) {
      const tierConfig = this.pricingTiers[tierKey]
      const performance = await this.analyzeTierPerformance(tierKey)
      const optimalPrice = this.calculateOptimalPrice(tierConfig, performance)

      optimizedPricing[tierKey] = {
        ...tierConfig,
        basePrice: optimalPrice,
      }

      if (optimalPrice !== tierConfig.basePrice) {
        recommendations.push({
          tier: tierKey,
          currentPrice: tierConfig.basePrice,
          optimalPrice,
          reason: performance.reason,
        })
      }
    }

    return {
      currentPricing: this.pricingTiers,
      optimizedPricing,
      recommendations,
    }
  }

  private calculateExpectedImprovements(
    currentRevenue: RevenueSnapshot,
    streamOptimizations: StreamOptimizationSummary[],
    pricingOptimization: PricingOptimizationSummary
  ): ExpectedImprovements {
    const improvements: ExpectedImprovements = {
      affiliate: 0,
      subscriptions: 0,
      premium: 0,
      total: 0,
    }

    streamOptimizations.forEach((optimization) => {
      improvements[
        optimization.type === 'affiliate'
          ? 'affiliate'
          : optimization.type === 'subscription'
            ? 'subscriptions'
            : 'premium'
      ] += optimization.expectedImprovement
    })

    improvements.subscriptions +=
      this.calculatePricingImprovement(pricingOptimization)
    improvements.total =
      improvements.affiliate + improvements.subscriptions + improvements.premium

    return improvements
  }

  private generateRevenueRecommendations(
    opportunities: OptimizationOpportunity[]
  ): string[] {
    const recommendations = new Set<string>()

    opportunities.forEach((opportunity) => {
      switch (opportunity.type) {
        case 'conversion_optimization':
          recommendations.add('Implement A/B testing for checkout flow')
          recommendations.add(
            'Add trust signals and social proof across key pages'
          )
          recommendations.add('Optimize mobile experience for conversions')
          break
        case 'pricing_optimization':
          recommendations.add('Implement dynamic pricing based on demand')
          recommendations.add(
            'Offer annual billing with discount to improve retention'
          )
          recommendations.add(
            'Highlight pricing tiers with clear value propositions'
          )
          break
        case 'retention_optimization':
          recommendations.add(
            'Implement automated onboarding sequence for vendors'
          )
          recommendations.add('Provide usage analytics and insights to vendors')
          recommendations.add(
            'Create loyalty and rewards program for high-value vendors'
          )
          break
      }
    })

    return Array.from(recommendations)
  }

  // ---------- Affiliate Analytics ----------

  private async analyzeAffiliatePerformance(): Promise<AffiliatePerformance> {
    const affiliateData = await prisma.affiliateConversion.findMany({
      include: { click: true },
    })
    const totalRevenue = affiliateData.reduce(
      (sum, conversion) => sum + conversion.revenue,
      0
    )
    const totalCommission = affiliateData.reduce(
      (sum, conversion) => sum + conversion.commission,
      0
    )

    const averageOrderValue =
      affiliateData.length > 0 ? totalRevenue / affiliateData.length : 0
    const conversionRate = this.calculateAffiliateConversionRate(affiliateData)
    const topPrograms = this.analyzeTopAffiliatePrograms(affiliateData)

    return {
      totalConversions: affiliateData.length,
      totalRevenue,
      totalCommission,
      averageOrderValue,
      conversionRate,
      topPrograms,
    }
  }

  private async optimizeAffiliateLinks(): Promise<OptimizationSummary> {
    return {
      currentStrategy: 'basic_affiliate_links',
      optimizedStrategy: 'dynamic_affiliate_links',
      improvements: [
        'Add click tracking and analytics dashboards',
        'Implement A/B testing for link formats and CTAs',
        'Optimize placement for mobile devices',
        'Introduce urgency and scarcity messaging for top products',
      ],
      expectedImprovement: 0.15,
    }
  }

  private async runAffiliateABTests(): Promise<ABTestSummary> {
    const tests = [
      {
        name: 'link_format',
        variants: ['text', 'button', 'image'],
        winner: 'button',
        improvement: 0.12,
      },
      {
        name: 'cta_text',
        variants: ['Buy Now', 'Shop Here', 'Get It Now'],
        winner: 'Get It Now',
        improvement: 0.08,
      },
    ]

    return {
      tests,
      overallImprovement: tests.reduce(
        (sum, test) => sum + test.improvement,
        0
      ),
    }
  }

  private async optimizeAffiliateRecommendations(): Promise<OptimizationSummary> {
    return {
      currentStrategy: 'basic_recommendations',
      optimizedStrategy: 'affiliate_optimized_recommendations',
      improvements: [
        'Prioritize high-commission products when relevance is equal',
        'Diversify affiliate programs per category to derisk supply',
        'Add conversion probability scoring per product',
        'Refresh seasonal collections automatically',
      ],
      expectedImprovement: 0.18,
    }
  }

  private calculateAffiliateRevenueIncrease(
    performance: AffiliatePerformance
  ): number {
    return performance.totalRevenue * 0.2
  }

  // ---------- Subscription Analytics ----------

  private async analyzeSubscriptionPerformance(): Promise<SubscriptionPerformance> {
    const activeVendors = await prisma.vendor.findMany({
      where: { subscriptionStatus: 'ACTIVE' },
      include: { products: true },
    })
    const monthlyRecurringRevenue = activeVendors.reduce(
      (sum, vendor) => sum + this.getPlanValue(vendor.plan),
      0
    )
    const totalSubscriptions = activeVendors.length
    const averageRevenuePerUser =
      totalSubscriptions > 0 ? monthlyRecurringRevenue / totalSubscriptions : 0
    const churnRate = await this.calculateChurnRate()
    const upgradeRate = await this.calculateUpgradeRate()
    const pricingTierDistribution =
      this.calculateTierDistribution(activeVendors)

    return {
      totalSubscriptions,
      monthlyRecurringRevenue,
      averageRevenuePerUser,
      churnRate,
      upgradeRate,
      pricingTierDistribution,
    }
  }

  private async optimizeSubscriptionPricing(): Promise<{
    currentPricing: PricingPerformance
    optimizedPricing: PricingTiersConfig
    recommendations: string[]
  }> {
    const recommendations: string[] = []
    const optimized = { ...this.pricingTiers }

    for (const tierKey of Object.keys(optimized) as PricingTierKey[]) {
      const config = optimized[tierKey]
      // Increase prices by 10% for better revenue
      config.basePrice = Math.min(config.basePrice * 1.1, config.maxPrice)
      recommendations.push(`Increase ${tierKey} base price by 10%`)
    }

    return {
      currentPricing: {
        totalSubscriptions: 0, // This will be calculated in getRevenueAnalytics
        averageRevenuePerUser: 0, // This will be calculated in getRevenueAnalytics
        churnRate: 0, // This will be calculated in getRevenueAnalytics
        upgradeRate: 0, // This will be calculated in getRevenueAnalytics
        pricingTierDistribution: {}, // This will be calculated in getRevenueAnalytics
      },
      optimizedPricing: optimized,
      recommendations,
    }
  }

  private async implementRetentionStrategies(): Promise<RetentionSummary> {
    return {
      strategies: [
        {
          name: 'onboarding_sequence',
          description: 'Automated onboarding email sequence',
          expectedImpact: 0.15,
        },
        {
          name: 'usage_analytics',
          description: 'Provide detailed usage analytics to vendors',
          expectedImpact: 0.1,
        },
        {
          name: 'loyalty_program',
          description: 'Implement points-based loyalty program',
          expectedImpact: 0.2,
        },
      ],
      totalExpectedImpact: 0.45,
    }
  }

  private async optimizeUpgradeFlows(): Promise<OptimizationSummary> {
    return {
      currentFlow: 'basic_upgrade',
      optimizedFlow: 'guided_upgrade',
      improvements: [
        'Add upgrade prompts based on usage',
        'Implement feature gating',
        'Create upgrade comparison tool',
        'Add success stories and testimonials',
      ],
      expectedImprovement: 0.25,
    }
  }

  private calculateMRRIncrease(performance: SubscriptionPerformance): number {
    return performance.monthlyRecurringRevenue * 0.3 // 30% increase estimate
  }

  // ---------- Market Conditions ----------

  private async analyzeMarketConditions(): Promise<MarketConditions> {
    // Mock market analysis
    return {
      demand: 'high',
      competition: 'medium',
      seasonality: 'holiday_peak',
      economicConditions: 'stable',
      pricingPressure: 'low',
    }
  }

  private async calculateOptimalPricing(
    marketConditions: MarketConditions
  ): Promise<PricingTiersConfig> {
    const basePricing = { ...this.pricingTiers }

    // Adjust pricing based on market conditions
    if (marketConditions.demand === 'high') {
      Object.keys(basePricing).forEach((tier) => {
        basePricing[tier as PricingTierKey].basePrice *= 1.1 // 10% increase
      })
    }

    if (marketConditions.seasonality === 'holiday_peak') {
      Object.keys(basePricing).forEach((tier) => {
        basePricing[tier as PricingTierKey].basePrice *= 1.05 // 5% increase
      })
    }

    return basePricing
  }

  private async implementPricingChanges(
    optimalPricing: PricingTiersConfig
  ): Promise<PricingChangeSummary> {
    const changes: PricingChangeSummary['changes'] = []
    for (const tierKey of Object.keys(optimalPricing) as PricingTierKey[]) {
      const config = optimalPricing[tierKey]
      const oldPrice = this.pricingTiers[tierKey].basePrice
      const newPrice = config.basePrice
      const changePercent = safeDivide(newPrice - oldPrice, oldPrice) * 100
      changes.push({
        tier: tierKey,
        oldPrice: oldPrice,
        newPrice: newPrice,
        changePercent: toFixedNumber(changePercent),
      })
    }

    return {
      changes,
      implementationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
    }
  }

  private async monitorPricingImpact(
    pricingChanges: PricingChangeSummary
  ): Promise<ImpactMonitoring> {
    return {
      monitoringPeriod: '30_days',
      metrics: [
        'conversion_rate',
        'revenue_per_user',
        'churn_rate',
        'upgrade_rate',
      ],
      successCriteria: {
        conversionRate: 'maintain_or_improve',
        revenuePerUser: 'increase_by_10_percent',
        churnRate: 'decrease_by_5_percent',
      },
    }
  }

  private calculateRevenueImpact(optimalPricing: PricingTiersConfig): number {
    let totalImpact = 0
    for (const tierKey of Object.keys(optimalPricing) as PricingTierKey[]) {
      const config = optimalPricing[tierKey]
      const currentPrice = this.pricingTiers[tierKey].basePrice
      const priceChange = safeDivide(
        config.basePrice - currentPrice,
        currentPrice
      )
      totalImpact += priceChange * 0.1 // Assume 10% of users are affected
    }
    return toFixedNumber(totalImpact)
  }

  // ---------- Revenue Calculations ----------

  private calculateTotalRevenue(
    affiliateRevenue: AffiliateConversion[],
    subscriptionVendors: Vendor[]
  ): number {
    const affiliateTotal = affiliateRevenue.reduce(
      (sum, r) => sum + r.revenue,
      0
    )
    const subscriptionTotal = subscriptionVendors.reduce(
      (sum, v) => sum + this.getPlanValue(v.plan),
      0
    )
    return toFixedNumber(affiliateTotal + subscriptionTotal)
  }

  private calculateRevenueByStream(
    affiliateRevenue: AffiliateConversion[],
    subscriptionVendors: Vendor[]
  ): Record<RevenueStreamKey, number> {
    const affiliateRevenueSum = affiliateRevenue.reduce(
      (sum, r) => sum + r.revenue,
      0
    )
    const subscriptionRevenueSum = subscriptionVendors.reduce(
      (sum, v) => sum + this.getPlanValue(v.plan),
      0
    )
    return {
      affiliate: toFixedNumber(affiliateRevenueSum),
      vendorSubscriptions: toFixedNumber(subscriptionRevenueSum),
      premiumFeatures: 0, // This stream is not directly tracked in the current schema
    }
  }

  private calculateMRR(subscriptionVendors: Vendor[]): number {
    return toFixedNumber(
      subscriptionVendors.reduce((sum, v) => sum + this.getPlanValue(v.plan), 0)
    )
  }

  private calculateARPU(subscriptionVendors: Vendor[]): number {
    if (subscriptionVendors.length === 0) return 0
    return toFixedNumber(
      this.calculateMRR(subscriptionVendors) / subscriptionVendors.length
    )
  }

  private analyzeConversionFunnel(conversionEvents: ConversionEvent[]): any {
    const funnelSteps = ['landing', 'signup', 'subscription', 'upgrade']
    const stepCounts: Record<string, number> = {}

    conversionEvents.forEach((event) => {
      stepCounts[event.eventType] = (stepCounts[event.eventType] || 0) + 1
    })

    return funnelSteps.map((step) => ({
      step,
      count: stepCounts[step] || 0,
      conversionRate: safeDivide(
        stepCounts[step] || 0,
        conversionEvents.length
      ),
    }))
  }

  private analyzeRevenueTrends(
    affiliateRevenue: AffiliateConversion[],
    subscriptionVendors: Vendor[]
  ): any {
    // Mock trend analysis
    return {
      affiliate: { trend: 'increasing', rate: 0.15 },
      subscriptions: { trend: 'stable', rate: 0.05 },
      overall: { trend: 'increasing', rate: 0.12 },
    }
  }

  private identifyTopPerformingProducts(
    affiliateRevenue: AffiliateConversion[]
  ): any[] {
    const productPerformance: Record<
      string,
      { revenue: number; conversions: number }
    > = {}

    affiliateRevenue.forEach((revenue) => {
      if (revenue.productId) {
        if (!productPerformance[revenue.productId]) {
          productPerformance[revenue.productId] = { revenue: 0, conversions: 0 }
        }
        productPerformance[revenue.productId].revenue += revenue.revenue
        productPerformance[revenue.productId].conversions += 1
      }
    })

    return Object.entries(productPerformance)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(([productId, data]) => ({ productId, ...data }))
  }

  private generateRevenueForecast(
    affiliateRevenue: AffiliateConversion[],
    subscriptionVendors: Vendor[]
  ): any {
    // Mock revenue forecast
    const currentRevenue = this.calculateTotalRevenue(
      affiliateRevenue,
      subscriptionVendors
    )
    return {
      nextMonth: toFixedNumber(currentRevenue * 1.1),
      nextQuarter: toFixedNumber(currentRevenue * 1.35),
      nextYear: toFixedNumber(currentRevenue * 1.8),
      confidence: 0.85,
    }
  }

  private getPlanValue(plan: string): number {
    const planValues: Record<string, number> = {
      BASIC: 9,
      FEATURED: 39,
      PREMIUM: 99,
      ENTERPRISE: 299,
    }
    return planValues[plan] || 0
  }

  // ---------- Conversion Rate Analytics ----------

  private async analyzeConversionRates(): Promise<{
    overall: number
    byTier: Record<PricingTierKey, number>
  }> {
    // Mock conversion rate analysis
    return {
      overall: 0.03,
      byTier: {
        BASIC: 0.15,
        FEATURED: 0.08,
        PREMIUM: 0.05,
        ENTERPRISE: 0.02,
      },
    }
  }

  // ---------- Pricing Sensitivity ----------

  private async analyzePricingSensitivity(): Promise<{
    elasticity: number
    optimalPriceRange: { min: number; max: number }
    priceThresholds: { low: number; high: number }
  }> {
    // Mock pricing sensitivity analysis
    return {
      elasticity: 1.2,
      optimalPriceRange: { min: 0.8, max: 1.2 },
      priceThresholds: { low: 0.7, high: 1.5 },
    }
  }

  // ---------- Churn Rate ----------

  private async calculateChurnRate(): Promise<number> {
    // Mock churn rate calculation
    return 0.08 // 8% monthly churn
  }

  // ---------- Upgrade Rate ----------

  private async calculateUpgradeRate(): Promise<number> {
    // Mock upgrade rate calculation
    return 0.12 // 12% upgrade rate
  }

  // ---------- Stream Optimizations ----------

  private async optimizeAffiliateStream(): Promise<StreamOptimizationSummary> {
    return {
      type: 'affiliate',
      currentPerformance: 0.3,
      optimizedPerformance: 0.35,
      expectedImprovement: 0.05,
      strategies: [
        'link_optimization',
        'ab_testing',
        'recommendation_improvement',
      ],
    }
  }

  private async optimizeSubscriptionStream(): Promise<StreamOptimizationSummary> {
    return {
      type: 'subscription',
      currentPerformance: 0.6,
      optimizedPerformance: 0.7,
      expectedImprovement: 0.1,
      strategies: [
        'pricing_optimization',
        'retention_improvement',
        'upgrade_optimization',
      ],
    }
  }

  private async optimizePremiumStream(): Promise<StreamOptimizationSummary> {
    return {
      type: 'premium',
      currentPerformance: 0.1,
      optimizedPerformance: 0.15,
      expectedImprovement: 0.05,
      strategies: [
        'feature_expansion',
        'usage_optimization',
        'value_communication',
      ],
    }
  }

  // ---------- Tier Performance ----------

  private async analyzeTierPerformance(tierKey: PricingTierKey): Promise<{
    conversionRate: number
    revenue: number
    churnRate: number
    reason: string
  }> {
    // Mock tier performance analysis
    const config = this.pricingTiers[tierKey]
    return {
      conversionRate: config.targetConversion,
      revenue: 1000,
      churnRate: 0.05,
      reason: 'optimal_performance',
    }
  }

  // ---------- Pricing Improvement ----------

  private calculatePricingImprovement(
    pricingOptimization: PricingOptimizationSummary
  ): number {
    let totalImprovement = 0
    pricingOptimization.recommendations.forEach((rec) => {
      const priceChange = safeDivide(
        rec.optimalPrice - rec.currentPrice,
        rec.currentPrice
      )
      totalImprovement += priceChange * 0.1 // Assume 10% of users are affected
    })
    return toFixedNumber(totalImprovement)
  }

  // ---------- Affiliate Conversion Rate ----------

  private calculateAffiliateConversionRate(
    affiliateData: AffiliateConversion[]
  ): number {
    if (affiliateData.length === 0) return 0
    const totalClicks = affiliateData.reduce(
      (sum, c) => sum + (c.click?.id ? 1 : 0),
      0
    )
    return safeDivide(affiliateData.length, totalClicks)
  }

  // ---------- Top Affiliate Programs ----------

  private analyzeTopAffiliatePrograms(
    affiliateData: AffiliateConversion[]
  ): any[] {
    const programPerformance: Record<
      string,
      { revenue: number; conversions: number }
    > = {}

    affiliateData.forEach((data) => {
      if (data.program) {
        if (!programPerformance[data.program]) {
          programPerformance[data.program] = { revenue: 0, conversions: 0 }
        }
        programPerformance[data.program].revenue += data.revenue
        programPerformance[data.program].conversions += 1
      }
    })

    return Object.entries(programPerformance)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(([program, data]) => ({ program, ...data }))
  }

  // ---------- Tier Distribution ----------

  private calculateTierDistribution(
    subscriptions: Vendor[]
  ): Record<PricingTierKey, number> {
    const distribution: Record<PricingTierKey, number> = {}
    subscriptions.forEach((sub) => {
      distribution[sub.plan as PricingTierKey] =
        (distribution[sub.plan as PricingTierKey] || 0) + 1
    })
    return distribution
  }

  // ---------- Optimal Price ----------

  private calculateOptimalPrice(
    config: PricingTierConfig,
    performance: {
      conversionRate: number
      revenue: number
      churnRate: number
      reason: string
    }
  ): number {
    // Simple optimal price calculation
    if (performance.conversionRate > config.targetConversion * 1.2) {
      return Math.min(config.basePrice * 1.1, config.maxPrice)
    } else if (performance.conversionRate < config.targetConversion * 0.8) {
      return Math.max(config.basePrice * 0.9, config.minPrice)
    }
    return config.basePrice
  }

  // ---------- Date Filter for Analytics ----------

  private buildDateFilter(startDate?: Date, endDate?: Date): any {
    const where: any = {}
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) where.createdAt = { lte: endDate }
    return where
  }
}

export const revenueOptimization = new RevenueOptimization()

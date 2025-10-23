import { CheckoutFlow, Vendor } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// --- Types -----------------------------------------------------------------

type ExperimentKey =
  | 'checkoutFlow'
  | 'pricingDisplay'
  | 'ctaButtons'
  | 'trustSignals'

type CheckoutFlowVariant = 'single-step' | 'multi-step' | 'progressive'

type ExperimentConfig<V extends string> = {
  variants: V[]
  currentVariant: V
  trafficSplit: Record<V, number>
}

type ExperimentConfigs = {
  checkoutFlow: ExperimentConfig<CheckoutFlowVariant>
  pricingDisplay: ExperimentConfig<'monthly' | 'annual' | 'comparison'>
  ctaButtons: ExperimentConfig<'primary' | 'secondary' | 'gradient'>
  trustSignals: ExperimentConfig<'testimonials' | 'badges' | 'stats'>
}

interface OptimizationResult {
  success: boolean
  optimizations?: string[]
  expectedImprovement?: number
  metrics?: ConversionFunnelSummary
  error?: string
}

interface PricingOptimizationResult {
  success: boolean
  currentPricing?: PricingAnalysis
  optimalPricing?: OptimalPricing
  competitorData?: CompetitorPricing
  testResults?: PricingTests
  recommendations?: string[]
  error?: string
}

interface RecommendationOptimizationResult {
  success: boolean
  userBehavior?: UserBehaviorSummary
  recommendationPerformance?: RecommendationPerformance
  optimizedAlgorithm?: OptimizedAlgorithm
  testResults?: RecommendationTestResult
  expectedImprovement?: number
  error?: string
}

interface ConversionFunnelSummary {
  steps: ConversionFunnelStep[]
  dropOffRates: number[]
  bottlenecks: string[]
  optimizationOpportunities: OptimizationOpportunity[]
}

interface ConversionFunnelStep {
  step: string
  conversionRate: number
  dropOff?: number
}

interface OptimizationOpportunity {
  step: string
  currentRate: number
  potentialImprovement: number
  optimization: string
}

interface PricingAnalysis {
  totalSubscriptions: number
  averageRevenuePerUser: number
  churnRate: number
  upgradeRate: number
  pricingTierDistribution: Record<string, number>
}

interface OptimalPricing {
  basic: number
  premium: number
  enterprise: number
  rationale: string
}

interface CompetitorPricing {
  competitors: Array<{
    name: string
    basicPrice: number
    premiumPrice: number
    enterprisePrice: number
  }>
  marketAverage: { basic: number; premium: number; enterprise: number }
}

interface PricingTests {
  basicPriceTest: PricingTestResult
  premiumPriceTest: PricingTestResult
  enterprisePriceTest: PricingTestResult
}

interface PricingTestResult {
  current: number
  tested: number
  improvement: number
}

interface UserBehaviorSummary {
  totalInteractions: number
  averageSessionDuration: number
  preferredCategories: string[]
  interactionPatterns: InteractionPatterns
  conversionProbability: number
}

interface InteractionPatterns {
  peakHours: number[]
  deviceTypes: Record<string, number>
  sessionLengths: SessionLengthSummary
}

interface SessionLengthSummary {
  average: number
  median: number
  min: number
  max: number
}

interface RecommendationPerformance {
  totalRecommendations: number
  clickThroughRate: number
  conversionRate: number
  averageRating: number
  topPerformingCategories: string[]
}

interface OptimizedAlgorithm {
  algorithm: string
  parameters: Record<string, number>
  expectedImprovement: number
}

interface RecommendationTestResult {
  testGroup: string
  controlGroup: string
  improvement: number
  confidence: number
  sampleSize: number
}

interface ABTestAssignmentPayload {
  userId: string
  experimentName: ExperimentKey
}

interface ConversionScoreUpdate {
  score: number
  eventType: string
  value?: number
}

// Helper functions ----------------------------------------------------------

const toFixedNumber = (value: number, digits = 2) =>
  Number(value.toFixed(digits))
const safeDivide = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator

const toCheckoutFlowEnum = (variant: CheckoutFlowVariant): CheckoutFlow => {
  switch (variant) {
    case 'single-step':
      return CheckoutFlow.SINGLE_STEP
    case 'multi-step':
      return CheckoutFlow.MULTI_STEP
    case 'progressive':
      return CheckoutFlow.PROGRESSIVE
    default:
      return CheckoutFlow.SINGLE_STEP
  }
}

const formatVariantLabel = (variant: string) => variant.replace('-', ' ')

// Conversion Optimization Manager -------------------------------------------------

export class ConversionOptimization {
  // A/B test configurations
  private experiments: ExperimentConfigs = {
    checkoutFlow: {
      variants: ['single-step', 'multi-step', 'progressive'],
      currentVariant: 'single-step',
      trafficSplit: { 'single-step': 0.4, 'multi-step': 0.3, progressive: 0.3 },
    },
    pricingDisplay: {
      variants: ['monthly', 'annual', 'comparison'],
      currentVariant: 'monthly',
      trafficSplit: { monthly: 0.5, annual: 0.3, comparison: 0.2 },
    },
    ctaButtons: {
      variants: ['primary', 'secondary', 'gradient'],
      currentVariant: 'primary',
      trafficSplit: { primary: 0.4, secondary: 0.3, gradient: 0.3 },
    },
    trustSignals: {
      variants: ['testimonials', 'badges', 'stats'],
      currentVariant: 'testimonials',
      trafficSplit: { testimonials: 0.4, badges: 0.3, stats: 0.3 },
    },
  }

  // Optimize checkout flow for a vendor
  async optimizeCheckoutFlow(vendorId: string): Promise<OptimizationResult> {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      })

      if (!vendor) {
        throw new Error('Vendor not found')
      }

      const funnelAnalysis = await this.analyzeConversionFunnel(vendorId)
      const abTestResults = await this.getABTestResults(
        'checkoutFlow',
        vendorId
      )
      const optimalFlow = this.determineOptimalFlow(
        funnelAnalysis,
        abTestResults
      )

      await this.applyCheckoutOptimization(vendor, optimalFlow)

      return {
        success: true,
        optimizations: [formatVariantLabel(optimalFlow)],
        expectedImprovement: this.calculateExpectedImprovement(funnelAnalysis),
        metrics: funnelAnalysis,
      }
    } catch (error) {
      console.error('Error optimizing checkout flow:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Optimize pricing strategy
  async optimizePricingStrategy(): Promise<PricingOptimizationResult> {
    try {
      // Analyze current pricing performance
      const pricingAnalysis = await this.analyzePricingPerformance()

      // Get competitor pricing data
      const competitorData = await this.getCompetitorPricing()

      // Calculate optimal pricing tiers
      const optimalPricing = this.calculateOptimalPricing(
        pricingAnalysis,
        competitorData
      )

      // Test pricing changes
      const pricingTests = await this.runPricingTests(optimalPricing)

      return {
        success: true,
        currentPricing: pricingAnalysis,
        optimalPricing,
        competitorData,
        testResults: pricingTests,
        recommendations: this.generatePricingRecommendations(optimalPricing),
      }
    } catch (error) {
      console.error('Error optimizing pricing strategy:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Optimize product recommendations
  async optimizeRecommendations(
    userId: string
  ): Promise<RecommendationOptimizationResult> {
    try {
      // Get user behavior data
      const userBehavior = await this.analyzeUserBehavior(userId)

      // Get recommendation performance
      const recommendationPerformance =
        await this.analyzeRecommendationPerformance(userId)

      // Optimize recommendation algorithm
      const optimizedAlgorithm = await this.optimizeRecommendationAlgorithm(
        userBehavior,
        recommendationPerformance
      )

      // Test new recommendations
      const testResults = await this.testRecommendations(
        userId,
        optimizedAlgorithm
      )

      return {
        success: true,
        userBehavior,
        recommendationPerformance,
        optimizedAlgorithm,
        testResults,
        expectedImprovement: this.calculateRecommendationImprovement(
          recommendationPerformance
        ),
      }
    } catch (error) {
      console.error('Error optimizing recommendations:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // Run A/B test
  async runABTest(
    experimentName: keyof typeof this.experiments,
    userId: string,
    variant?: string
  ): Promise<string> {
    try {
      // Check if user already has a variant assigned
      const existingAssignment = await prisma.abTestAssignment.findFirst({
        where: {
          userId,
          experimentName,
        },
      })

      if (existingAssignment) {
        return existingAssignment.variant
      }

      // Assign variant based on traffic split
      const experiment = this.experiments[experimentName as ExperimentKey]
      const assignedVariant =
        variant || this.assignVariant(experiment.trafficSplit)

      // Record assignment
      await prisma.abTestAssignment.create({
        data: {
          userId,
          experimentName,
          variant: assignedVariant,
          assignedAt: new Date(),
        },
      })

      return assignedVariant
    } catch (error) {
      console.error('Error running A/B test:', error)
      return this.experiments[experimentName as ExperimentKey].currentVariant
    }
  }

  // Track conversion event
  async trackConversion(
    userId: string,
    eventType: 'signup' | 'purchase' | 'subscription' | 'upgrade',
    value?: number,
    metadata?: Record<string, any>
  ) {
    try {
      await prisma.conversionEvent.create({
        data: {
          userId,
          eventType,
          value: value || 0,
          metadata: metadata || {},
          createdAt: new Date(),
        },
      })

      // Update user's conversion score
      await this.updateConversionScore(userId, eventType, value)
    } catch (error) {
      console.error('Error tracking conversion:', error)
    }
  }

  // Get conversion analytics
  async getConversionAnalytics(startDate?: Date, endDate?: Date) {
    const where: any = {}
    if (startDate) where.createdAt = { gte: startDate }
    if (endDate) where.createdAt = { lte: endDate }

    const [conversions, abTestResults, funnelData] = await Promise.all([
      prisma.conversionEvent.findMany({ where }),
      prisma.abTestResult.findMany({ where }),
      prisma.conversionFunnel.findMany({ where }),
    ])

    return {
      totalConversions: conversions.length,
      conversionValue: conversions.reduce((sum, c) => sum + c.value, 0),
      conversionRate: this.calculateConversionRate(conversions),
      abTestResults: this.aggregateABTestResults(abTestResults),
      funnelAnalysis: this.analyzeFunnelData(funnelData),
      topConvertingPaths: this.identifyTopConvertingPaths(conversions),
      recommendations: this.generateConversionRecommendations(conversions),
    }
  }

  // Private helper methods
  private async analyzeConversionFunnel(vendorId: string) {
    const funnel = await prisma.conversionFunnel.findMany({
      where: { vendorId },
      orderBy: { step: 'asc' },
    })

    return {
      steps: funnel,
      dropOffRates: this.calculateDropOffRates(funnel),
      bottlenecks: this.identifyBottlenecks(funnel),
      optimizationOpportunities: this.identifyOptimizationOpportunities(funnel),
    }
  }

  private async getABTestResults(experimentName: string, vendorId?: string) {
    const where: any = { experimentName }
    if (vendorId) where.vendorId = vendorId

    return await prisma.abTestResult.findMany({ where })
  }

  private determineOptimalFlow(funnelAnalysis: any, abTestResults: any[]) {
    // Analyze funnel bottlenecks
    const bottlenecks = funnelAnalysis.bottlenecks
    const bestPerformingVariant = this.findBestPerformingVariant(abTestResults)

    if (
      bottlenecks.includes('checkout') &&
      bestPerformingVariant === 'multi-step'
    ) {
      return 'multi-step'
    } else if (
      bottlenecks.includes('payment') &&
      bestPerformingVariant === 'progressive'
    ) {
      return 'progressive'
    } else {
      return 'single-step'
    }
  }

  private async applyCheckoutOptimization(vendor: Vendor, flow: string) {
    await prisma.vendor.update({
      where: { id: vendor.id },
      data: {
        checkoutFlow: toCheckoutFlowEnum(flow as CheckoutFlowVariant),
        optimizationAppliedAt: new Date(),
      },
    })
  }

  private calculateExpectedImprovement(funnelAnalysis: any): number {
    const currentConversionRate =
      funnelAnalysis.steps[funnelAnalysis.steps.length - 1]?.conversionRate || 0
    const potentialImprovement =
      funnelAnalysis.optimizationOpportunities.reduce(
        (sum: number, opp: any) => sum + opp.potentialImprovement,
        0
      )
    return currentConversionRate + potentialImprovement
  }

  private async analyzePricingPerformance() {
    const subscriptions = await prisma.vendor.findMany({
      where: { subscriptionStatus: 'ACTIVE' },
      include: { products: true },
    })

    return {
      totalSubscriptions: subscriptions.length,
      averageRevenuePerUser:
        subscriptions.reduce((sum, v) => sum + this.getPlanValue(v.plan), 0) /
        subscriptions.length,
      churnRate: await this.calculateChurnRate(),
      upgradeRate: await this.calculateUpgradeRate(),
      pricingTierDistribution:
        this.calculatePricingTierDistribution(subscriptions),
    }
  }

  private async getCompetitorPricing() {
    // Mock competitor data - in real implementation, this would fetch from external APIs
    return {
      competitors: [
        {
          name: 'Competitor A',
          basicPrice: 15,
          premiumPrice: 45,
          enterprisePrice: 150,
        },
        {
          name: 'Competitor B',
          basicPrice: 12,
          premiumPrice: 35,
          enterprisePrice: 120,
        },
        {
          name: 'Competitor C',
          basicPrice: 20,
          premiumPrice: 60,
          enterprisePrice: 200,
        },
      ],
      marketAverage: { basic: 15.67, premium: 46.67, enterprise: 156.67 },
    }
  }

  private calculateOptimalPricing(pricingAnalysis: any, competitorData: any) {
    const currentARPU = pricingAnalysis.averageRevenuePerUser
    const marketAverage = competitorData.marketAverage

    return {
      basic: Math.max(currentARPU * 0.3, marketAverage.basic * 0.8),
      premium: Math.max(currentARPU * 0.7, marketAverage.premium * 0.8),
      enterprise: Math.max(currentARPU * 1.5, marketAverage.enterprise * 0.8),
      rationale:
        'Pricing optimized based on current ARPU and market positioning',
    }
  }

  private async runPricingTests(optimalPricing: any) {
    // Mock pricing test results
    return {
      basicPriceTest: {
        current: 9,
        tested: optimalPricing.basic,
        improvement: 0.15,
      },
      premiumPriceTest: {
        current: 29,
        tested: optimalPricing.premium,
        improvement: 0.08,
      },
      enterprisePriceTest: {
        current: 99,
        tested: optimalPricing.enterprise,
        improvement: 0.12,
      },
    }
  }

  private generatePricingRecommendations(optimalPricing: any) {
    return [
      `Consider increasing basic tier to $${optimalPricing.basic.toFixed(2)} for better revenue per user`,
      `Premium tier at $${optimalPricing.premium.toFixed(2)} aligns with market positioning`,
      `Enterprise tier at $${optimalPricing.enterprise.toFixed(2)} provides room for growth`,
      'Implement annual discount of 20% to improve retention',
      'Add usage-based pricing for high-volume vendors',
    ]
  }

  private async analyzeUserBehavior(userId: string) {
    const userInteractions = await prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return {
      totalInteractions: userInteractions.length,
      averageSessionDuration:
        this.calculateAverageSessionDuration(userInteractions),
      preferredCategories: this.analyzePreferredCategories(userInteractions),
      interactionPatterns: this.analyzeInteractionPatterns(userInteractions),
      conversionProbability:
        this.calculateConversionProbability(userInteractions),
    }
  }

  private async analyzeRecommendationPerformance(userId: string) {
    const recommendations = await prisma.recommendationLog.findMany({
      where: { userId },
      include: { clicks: true, conversions: true },
    })

    return {
      totalRecommendations: recommendations.length,
      clickThroughRate: this.calculateCTR(recommendations),
      conversionRate: this.calculateConversionRate(recommendations),
      averageRating: this.calculateAverageRating(recommendations),
      topPerformingCategories:
        this.analyzeTopPerformingCategories(recommendations),
    }
  }

  private async optimizeRecommendationAlgorithm(
    userBehavior: any,
    performance: any
  ) {
    // Mock algorithm optimization
    return {
      algorithm: 'hybrid-collaborative-content-based',
      parameters: {
        collaborativeWeight: 0.6,
        contentWeight: 0.4,
        diversityBoost: 0.1,
        noveltyBoost: 0.05,
      },
      expectedImprovement: 0.12,
    }
  }

  private async testRecommendations(userId: string, algorithm: any) {
    // Mock test results
    return {
      testGroup: 'optimized',
      controlGroup: 'current',
      improvement: 0.15,
      confidence: 0.95,
      sampleSize: 1000,
    }
  }

  private calculateRecommendationImprovement(performance: any): number {
    return performance.conversionRate * 0.15 // 15% improvement estimate
  }

  private assignVariant(trafficSplit: Record<string, number>): string {
    const random = Math.random()
    let cumulative = 0

    for (const [variant, weight] of Object.entries(trafficSplit)) {
      cumulative += weight
      if (random <= cumulative) {
        return variant
      }
    }

    return Object.keys(trafficSplit)[0]
  }

  private async updateConversionScore(
    userId: string,
    eventType: string,
    value?: number
  ) {
    const score = this.calculateConversionScore(eventType, value)

    await prisma.user.update({
      where: { id: userId },
      data: {
        conversionScore: {
          increment: score,
        },
      },
    })
  }

  private calculateConversionScore(eventType: string, value?: number): number {
    const baseScores = {
      signup: 10,
      purchase: 50,
      subscription: 100,
      upgrade: 75,
    }

    const baseScore = baseScores[eventType as keyof typeof baseScores] || 0
    const valueMultiplier = value ? Math.log10(value + 1) : 1

    return baseScore * valueMultiplier
  }

  private calculateConversionRate(conversions: any[]): number {
    if (conversions.length === 0) return 0
    return conversions.filter((c) => c.value > 0).length / conversions.length
  }

  private calculateCTR(recommendations: any[]): number {
    if (recommendations.length === 0) return 0
    const totalClicks = recommendations.reduce(
      (sum, r) => sum + r.clicks.length,
      0
    )
    return totalClicks / recommendations.length
  }

  private calculateAverageRating(recommendations: any[]): number {
    if (recommendations.length === 0) return 0
    const totalRating = recommendations.reduce(
      (sum, r) => sum + (r.rating || 0),
      0
    )
    return totalRating / recommendations.length
  }

  private calculateDropOffRates(funnel: any[]): number[] {
    const rates: number[] = []
    for (let i = 1; i < funnel.length; i++) {
      const current = funnel[i].conversionRate
      const previous = funnel[i - 1].conversionRate
      rates.push((previous - current) / previous)
    }
    return rates
  }

  private identifyBottlenecks(funnel: any[]): string[] {
    const bottlenecks: string[] = []
    const dropOffRates = this.calculateDropOffRates(funnel)

    dropOffRates.forEach((rate, index) => {
      if (rate > 0.3) {
        // 30% drop-off threshold
        bottlenecks.push(funnel[index + 1].step)
      }
    })

    return bottlenecks
  }

  private identifyOptimizationOpportunities(funnel: any[]): any[] {
    return funnel.map((step) => ({
      step: step.step,
      currentRate: step.conversionRate,
      potentialImprovement: step.conversionRate * 0.1, // 10% improvement potential
      optimization: this.getOptimizationSuggestion(step.step),
    }))
  }

  private getOptimizationSuggestion(step: string): string {
    const suggestions: Record<string, string> = {
      landing: 'Improve page load speed and mobile experience',
      checkout: 'Simplify checkout process and add trust signals',
      payment: 'Add multiple payment options and security badges',
      confirmation: 'Send immediate confirmation email and next steps',
    }

    return suggestions[step] || 'Review user feedback and analytics'
  }

  private findBestPerformingVariant(abTestResults: any[]): string {
    if (abTestResults.length === 0) return 'single-step'

    const variantPerformance = abTestResults.reduce(
      (acc, result) => {
        if (!acc[result.variant]) {
          acc[result.variant] = { conversions: 0, total: 0 }
        }
        acc[result.variant].conversions += result.conversions
        acc[result.variant].total += result.total
        return acc
      },
      {} as Record<string, { conversions: number; total: number }>
    )

    let bestVariant = 'single-step'
    let bestRate = 0

    Object.entries(variantPerformance).forEach(([variant, data]) => {
      const rate = data.conversions / data.total
      if (rate > bestRate) {
        bestRate = rate
        bestVariant = variant
      }
    })

    return bestVariant
  }

  private calculateChurnRate(): Promise<number> {
    // Mock churn rate calculation
    return Promise.resolve(0.05) // 5% monthly churn
  }

  private calculateUpgradeRate(): Promise<number> {
    // Mock upgrade rate calculation
    return Promise.resolve(0.15) // 15% upgrade rate
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

  private calculatePricingTierDistribution(
    subscriptions: any[]
  ): Record<string, number> {
    const distribution: Record<string, number> = {}
    subscriptions.forEach((sub) => {
      distribution[sub.plan] = (distribution[sub.plan] || 0) + 1
    })
    return distribution
  }

  private calculateAverageSessionDuration(interactions: any[]): number {
    if (interactions.length === 0) return 0
    const durations = interactions.map((i) => i.duration || 0)
    return durations.reduce((sum, d) => sum + d, 0) / durations.length
  }

  private analyzePreferredCategories(interactions: any[]): string[] {
    const categoryCount: Record<string, number> = {}
    interactions.forEach((i) => {
      if (i.category) {
        categoryCount[i.category] = (categoryCount[i.category] || 0) + 1
      }
    })

    return Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category]) => category)
  }

  private analyzeInteractionPatterns(interactions: any[]): any {
    return {
      peakHours: this.findPeakHours(interactions),
      deviceTypes: this.analyzeDeviceTypes(interactions),
      sessionLengths: this.analyzeSessionLengths(interactions),
    }
  }

  private calculateConversionProbability(interactions: any[]): number {
    // Mock conversion probability calculation
    const recentInteractions = interactions.slice(0, 10)
    const engagementScore = recentInteractions.reduce(
      (sum, i) => sum + (i.engagement || 0),
      0
    )
    return Math.min(engagementScore / 100, 1) // Normalize to 0-1
  }

  private analyzeTopPerformingCategories(recommendations: any[]): string[] {
    const categoryPerformance: Record<
      string,
      { clicks: number; conversions: number }
    > = {}

    recommendations.forEach((rec) => {
      if (rec.category) {
        if (!categoryPerformance[rec.category]) {
          categoryPerformance[rec.category] = { clicks: 0, conversions: 0 }
        }
        categoryPerformance[rec.category].clicks += rec.clicks.length
        categoryPerformance[rec.category].conversions += rec.conversions.length
      }
    })

    return Object.entries(categoryPerformance)
      .sort(
        ([, a], [, b]) => b.conversions / b.clicks - a.conversions / a.clicks
      )
      .slice(0, 5)
      .map(([category]) => category)
  }

  private findPeakHours(interactions: any[]): number[] {
    const hourCount: Record<number, number> = {}
    interactions.forEach((i) => {
      const hour = new Date(i.createdAt).getHours()
      hourCount[hour] = (hourCount[hour] || 0) + 1
    })

    return Object.entries(hourCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))
  }

  private analyzeDeviceTypes(interactions: any[]): Record<string, number> {
    const deviceCount: Record<string, number> = {}
    interactions.forEach((i) => {
      if (i.deviceType) {
        deviceCount[i.deviceType] = (deviceCount[i.deviceType] || 0) + 1
      }
    })
    return deviceCount
  }

  private analyzeSessionLengths(interactions: any[]): any {
    const lengths = interactions.map((i) => i.sessionLength || 0)
    return {
      average: lengths.reduce((sum, l) => sum + l, 0) / lengths.length,
      median: lengths.sort((a, b) => a - b)[Math.floor(lengths.length / 2)],
      min: Math.min(...lengths),
      max: Math.max(...lengths),
    }
  }

  private aggregateABTestResults(results: any[]): any {
    const aggregated: Record<string, any> = {}

    results.forEach((result) => {
      if (!aggregated[result.experimentName]) {
        aggregated[result.experimentName] = {}
      }
      if (!aggregated[result.experimentName][result.variant]) {
        aggregated[result.experimentName][result.variant] = {
          conversions: 0,
          total: 0,
          conversionRate: 0,
        }
      }
      aggregated[result.experimentName][result.variant].conversions +=
        result.conversions
      aggregated[result.experimentName][result.variant].total += result.total
    })

    // Calculate conversion rates
    Object.values(aggregated).forEach((experiment: any) => {
      Object.values(experiment).forEach((variant: any) => {
        variant.conversionRate =
          variant.total > 0 ? variant.conversions / variant.total : 0
      })
    })

    return aggregated
  }

  private analyzeFunnelData(funnelData: any[]): any {
    return {
      steps: funnelData,
      overallConversionRate: this.calculateOverallConversionRate(funnelData),
      stepAnalysis: funnelData.map((step) => ({
        step: step.step,
        conversionRate: step.conversionRate,
        dropOff: step.dropOff,
        optimization: step.optimization,
      })),
    }
  }

  private calculateOverallConversionRate(funnelData: any[]): number {
    if (funnelData.length === 0) return 0
    return funnelData[funnelData.length - 1].conversionRate
  }

  private identifyTopConvertingPaths(conversions: any[]): any[] {
    const pathCount: Record<string, number> = {}
    conversions.forEach((c) => {
      if (c.metadata?.path) {
        pathCount[c.metadata.path] = (pathCount[c.metadata.path] || 0) + 1
      }
    })

    return Object.entries(pathCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, count]) => ({ path, conversions: count }))
  }

  private generateConversionRecommendations(conversions: any[]): string[] {
    const recommendations = []

    if (conversions.length < 100) {
      recommendations.push('Increase traffic to improve conversion volume')
    }

    const conversionRate = this.calculateConversionRate(conversions)
    if (conversionRate < 0.02) {
      recommendations.push(
        'Optimize conversion funnel to improve conversion rate'
      )
    }

    const averageValue =
      conversions.reduce((sum, c) => sum + c.value, 0) / conversions.length
    if (averageValue < 50) {
      recommendations.push('Focus on higher-value conversions')
    }

    return recommendations
  }
}

// Type definitions
interface OptimizationResult {
  success: boolean
  optimizations?: string[]
  expectedImprovement?: number
  metrics?: any
  error?: string
}

interface PricingOptimizationResult {
  success: boolean
  currentPricing?: any
  optimalPricing?: any
  competitorData?: any
  testResults?: any
  recommendations?: string[]
  error?: string
}

interface RecommendationOptimizationResult {
  success: boolean
  userBehavior?: any
  recommendationPerformance?: any
  optimizedAlgorithm?: any
  testResults?: any
  expectedImprovement?: number
  error?: string
}

export const conversionOptimization = new ConversionOptimization()

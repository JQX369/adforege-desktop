import { AffiliateClick, AffiliateConversion, Product } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type AffiliateProgramKey =
  | 'amazon'
  | 'ebay'
  | 'etsy'
  | 'target'
  | 'walmart'
  | 'bestbuy'
  | 'homedepot'
  | 'lowes'
  | 'macys'
  | 'nordstrom'

interface AffiliateProgramConfig {
  id?: string
  rate: number
  domains: string[]
}

interface AffiliateProduct {
  id: string
  url: string
}

interface ProgramStats {
  clicks: number
  conversions: number
  revenue: number
  commission: number
  conversionRate: number
}

interface AffiliateAnalytics {
  totalClicks: number
  totalConversions: number
  totalRevenue: number
  totalCommission: number
  programStats: Record<AffiliateProgramKey, ProgramStats>
}

// Expanded Affiliate Program Manager
export class ExpandedAffiliateProgram {
  private readonly programs: Record<
    AffiliateProgramKey,
    AffiliateProgramConfig
  > = {
    amazon: {
      id: process.env.NEXT_PUBLIC_AMZ_TAG,
      rate: 0.04,
      domains: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.com.au'],
    },
    ebay: {
      id: process.env.EBAY_CAMPAIGN_ID,
      rate: 0.02,
      domains: ['ebay.com', 'ebay.co.uk', 'ebay.ca', 'ebay.com.au'],
    },
    etsy: {
      id: process.env.NEXT_PUBLIC_ETSY_ID,
      rate: 0.03,
      domains: ['etsy.com'],
    },
    target: {
      id: process.env.TARGET_PARTNER_ID,
      rate: 0.02,
      domains: ['target.com'],
    },
    walmart: {
      id: process.env.WALMART_PARTNER_ID,
      rate: 0.02,
      domains: ['walmart.com'],
    },
    bestbuy: {
      id: process.env.BESTBUY_PARTNER_ID,
      rate: 0.015,
      domains: ['bestbuy.com'],
    },
    homedepot: {
      id: process.env.HOMEDEPOT_PARTNER_ID,
      rate: 0.02,
      domains: ['homedepot.com'],
    },
    lowes: {
      id: process.env.LOWES_PARTNER_ID,
      rate: 0.02,
      domains: ['lowes.com'],
    },
    macys: {
      id: process.env.MACYS_PARTNER_ID,
      rate: 0.02,
      domains: ['macys.com'],
    },
    nordstrom: {
      id: process.env.NORDSTROM_PARTNER_ID,
      rate: 0.02,
      domains: ['nordstrom.com'],
    },
  }

  // Generate affiliate link for a product
  async generateAffiliateLink(
    product: AffiliateProduct,
    program: AffiliateProgramKey,
    userId?: string
  ): Promise<string> {
    const config = this.programs[program]
    if (!config.id) return product.url

    const baseUrl = product.url
    const clickId = this.generateClickId(userId, product.id)

    switch (program) {
      case 'amazon':
        return this.buildAmazonLink(baseUrl, config.id, clickId)
      case 'ebay':
        return this.buildEbayLink(baseUrl, config.id, clickId)
      case 'etsy':
        return this.buildEtsyLink(baseUrl, config.id, clickId)
      case 'target':
        return this.buildTargetLink(baseUrl, config.id, clickId)
      case 'walmart':
        return this.buildWalmartLink(baseUrl, config.id, clickId)
      case 'bestbuy':
        return this.buildBestBuyLink(baseUrl, config.id, clickId)
      case 'homedepot':
        return this.buildHomeDepotLink(baseUrl, config.id, clickId)
      case 'lowes':
        return this.buildLowesLink(baseUrl, config.id, clickId)
      case 'macys':
        return this.buildMacysLink(baseUrl, config.id, clickId)
      case 'nordstrom':
        return this.buildNordstromLink(baseUrl, config.id, clickId)
      default:
        return baseUrl
    }
  }

  // Track affiliate click
  async trackClick(
    clickId: string,
    program: AffiliateProgramKey,
    productId: string,
    userId?: string
  ) {
    try {
      await prisma.affiliateClick.create({
        data: {
          clickId,
          program,
          productId,
          userId,
          createdAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error tracking affiliate click:', error)
    }
  }

  // Track conversion
  async trackConversion(
    clickId: string,
    program: AffiliateProgramKey,
    revenue: number,
    orderId?: string
  ) {
    try {
      const config = this.programs[program]
      const commission = revenue * config.rate

      const click = await prisma.affiliateClick.findUnique({
        where: { clickId },
      })
      if (!click) {
        throw new Error(`Affiliate click ${clickId} not found`)
      }

      await prisma.affiliateConversion.create({
        data: {
          clickId,
          program,
          revenue,
          commission,
          orderId,
          productId: click.productId,
          createdAt: new Date(),
        },
      })

      // Update click record
      await prisma.affiliateClick.update({
        where: { clickId },
        data: { converted: true, conversionAt: new Date() },
      })
    } catch (error) {
      console.error('Error tracking affiliate conversion:', error)
    }
  }

  // Get affiliate performance analytics
  async getAffiliateAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<AffiliateAnalytics> {
    const where = this.buildDateFilter(startDate, endDate)

    const [clicks, conversions] = await Promise.all([
      prisma.affiliateClick.findMany({ where }),
      prisma.affiliateConversion.findMany({ where }),
    ])

    const programStats = this.createEmptyProgramStats()

    clicks.forEach((click: AffiliateClick) => {
      const stats = programStats[click.program as AffiliateProgramKey]
      if (stats) {
        stats.clicks += 1
      }
    })

    conversions.forEach((conversion: AffiliateConversion) => {
      const stats = programStats[conversion.program as AffiliateProgramKey]
      if (stats) {
        stats.conversions += 1
        stats.revenue += conversion.revenue
        stats.commission += conversion.commission
      }
    })

    Object.values(programStats).forEach((stats) => {
      stats.conversionRate =
        stats.clicks > 0 ? stats.conversions / stats.clicks : 0
    })

    const totalRevenue = conversions.reduce(
      (sum, conversion) => sum + conversion.revenue,
      0
    )
    const totalCommission = conversions.reduce(
      (sum, conversion) => sum + conversion.commission,
      0
    )

    return {
      totalClicks: clicks.length,
      totalConversions: conversions.length,
      totalRevenue,
      totalCommission,
      programStats,
    }
  }

  // Detect best affiliate program for a product
  detectBestProgram(product: Pick<Product, 'url'>): AffiliateProgramKey | null {
    try {
      const url = new URL(product.url)
      const hostname = url.hostname.toLowerCase()

      for (const [program, config] of Object.entries(this.programs) as [
        AffiliateProgramKey,
        AffiliateProgramConfig,
      ][]) {
        if (config.domains.some((domain) => hostname.includes(domain))) {
          return program
        }
      }

      return null
    } catch {
      return null
    }
  }

  // Private helper methods
  private generateClickId(userId?: string, productId?: string): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    const user = userId ? userId.substring(0, 8) : 'anon'
    const product = productId ? productId.substring(0, 8) : 'prod'
    return `${user}-${product}-${timestamp}-${random}`
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) {
      return {}
    }

    const createdAt: { gte?: Date; lte?: Date } = {}
    if (startDate) {
      createdAt.gte = startDate
    }
    if (endDate) {
      createdAt.lte = endDate
    }
    return { createdAt }
  }

  private createEmptyProgramStats(): Record<AffiliateProgramKey, ProgramStats> {
    return Object.keys(this.programs).reduce(
      (acc, key) => {
        acc[key as AffiliateProgramKey] = {
          clicks: 0,
          conversions: 0,
          revenue: 0,
          commission: 0,
          conversionRate: 0,
        }
        return acc
      },
      {} as Record<AffiliateProgramKey, ProgramStats>
    )
  }

  private buildAmazonLink(
    baseUrl: string,
    tag: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('tag', tag)
      url.searchParams.set('linkCode', 'ur2')
      url.searchParams.set('camp', '1789')
      url.searchParams.set('creative', '9325')
      url.searchParams.set('creativeASIN', url.pathname.split('/').pop() || '')
      url.searchParams.set('ref', `fairywize-${clickId}`)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildEbayLink(
    baseUrl: string,
    campaignId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('campid', campaignId)
      url.searchParams.set('customid', `fairywize-${clickId}`)
      url.searchParams.set('toolid', '10001')
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildEtsyLink(baseUrl: string, ref: string, clickId: string): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('ref', ref)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildTargetLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildWalmartLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildBestBuyLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildHomeDepotLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildLowesLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildMacysLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }

  private buildNordstromLink(
    baseUrl: string,
    partnerId: string,
    clickId: string
  ): string {
    try {
      const url = new URL(baseUrl)
      url.searchParams.set('affiliate_id', partnerId)
      url.searchParams.set('click_id', clickId)
      return url.toString()
    } catch {
      return baseUrl
    }
  }
}

export const affiliateProgram = new ExpandedAffiliateProgram()

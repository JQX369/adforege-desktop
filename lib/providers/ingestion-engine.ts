/**
 * Robust Ingestion Engine
 * Handles quality scoring, deduplication, database operations, and logging
 */

import {
  PrismaClient,
  ProductStatus,
  Prisma,
} from '@prisma/client'
import OpenAI from 'openai'
import {
  BaseProduct,
  IngestionResult,
  ProductRegionLinkInput,
  ProductTagInput,
} from './types'

export class IngestionEngine {
  private prisma: PrismaClient
  private openai: OpenAI

  constructor() {
    this.prisma = new PrismaClient()
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
  }

  /**
   * Ingest products into database with deduplication
   */
  async ingestProducts(products: BaseProduct[]): Promise<IngestionResult> {
    const startTime = Date.now()
    const result: IngestionResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      products: [],
      errorMessages: [],
      duration: 0,
    }

    for (const product of products) {
      try {
        // Generate embedding
        const embedding = await this.generateEmbedding(product)

        // Enhanced quality score with embedding
        const finalQualityScore = this.calculateFinalQualityScore(product, embedding.length > 0)
        
        // Determine status based on quality
        const status = finalQualityScore >= 0.80 
          ? ProductStatus.APPROVED 
          : finalQualityScore >= 0.60
            ? ProductStatus.PENDING
            : ProductStatus.REJECTED

        // Check for duplicates
        const existing = await this.findDuplicate(product)

        // Get or create merchant
        const merchant = await this.getOrCreateMerchant(product)

        const dataToSave = {
          title: product.title,
          description: product.description,
          shortDescription: product.shortDescription || product.title.slice(0, 150),
          price: product.price,
          originalPrice: product.originalPrice,
          discountPercent: product.discountPercent,
          currency: product.currency,
          images: product.images,
          imagesThumbnail: product.imagesThumbnail || product.images,
          affiliateUrl: product.affiliateUrl,
          categories: product.categories,
          status,
          source: product.source,
          retailer: product.retailer,
          availability: product.availability,
          brand: product.brand,
          asin: product.asin,
          affiliateProgram: product.affiliateProgram,
          urlCanonical: product.urlCanonical,
          qualityScore: finalQualityScore,
          recencyScore: product.recencyScore ?? this.calculateRecencyScore(product.listingStartAt),
          popularityScore: product.popularityScore ?? 0,
          lastSeenAt: new Date(),
          rating: product.rating,
          numReviews: product.numReviews,
          // New fields
          shippingCost: product.shippingCost,
          freeShipping: product.freeShipping,
          deliveryDays: product.deliveryDays,
          deliveryMin: product.deliveryMin,
          deliveryMax: product.deliveryMax,
          primeEligible: product.primeEligible,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          expiresAt: product.listingEndAt ? new Date(product.listingEndAt) : product.expiresAt ? new Date(product.expiresAt) : null,
          features: product.features || [],
          weight: product.weight,
          dimensions: product.dimensions,
          condition: product.condition,
          bestSeller: product.bestSeller,
          sellerName: product.sellerName,
          sellerRating: product.sellerRating,
          sourceItemId: product.sourceItemId,
          lastEnrichedAt: new Date(),
        }


        existing
          ? await this.prisma.product.update({
              where: { id: existing.id },
              data: this.buildUpdateData(
                {
                  ...dataToSave,
                  merchant: merchant ? { connect: { id: merchant.id } } : undefined,
                } as any,
                embedding,
              ),
            })
          : await this.prisma.product.create({
              data: this.buildCreateData(
                {
                  ...dataToSave,
                  // Use relation connect instead of raw merchantId assignment
                  merchant: merchant ? { connect: { id: merchant.id } } : undefined,
                } as any,
                embedding,
              ),
            })

        if (existing) {
          result.updated++
          console.log(`✅ Updated: ${product.title.slice(0, 60)}... (score: ${finalQualityScore.toFixed(2)})`)
        } else {
          result.created++
          console.log(`✨ Created: ${product.title.slice(0, 60)}... (score: ${finalQualityScore.toFixed(2)})`)
        }

        result.products.push(product)

        // Rate limiting for embeddings
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        result.errors++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        result.errorMessages.push(`${product.title}: ${errorMsg}`)
        console.error(`❌ Error ingesting ${product.title}:`, errorMsg)
      }
    }

    result.duration = Date.now() - startTime
    result.success = result.errors < products.length / 2 // Success if < 50% errors

    return result
  }

  /**
   * Generate embedding for semantic search
   */
  private async generateEmbedding(product: BaseProduct): Promise<number[]> {
    try {
      const text = `${product.title} ${product.description} ${product.categories.join(' ')}`
        .slice(0, 1500)

      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      })

      return response.data[0].embedding
    } catch (error) {
      console.error('Embedding generation failed:', error)
      return []
    }
  }

  /**
   * Calculate final quality score with embedding bonus
   */
  private calculateFinalQualityScore(product: BaseProduct, hasEmbedding: boolean): number {
    let score = product.qualityScore

    // Bonus for having embedding (critical for semantic search)
    if (hasEmbedding) {
      score += 0.15
    }

    return Math.min(score, 1.0)
  }

  /**
   * Find duplicate product using multiple strategies
   */
  private async findDuplicate(product: BaseProduct): Promise<{ id: string } | null> {
    // Strategy 1: Check by ASIN (Amazon)
    if (product.asin) {
      const byAsin = await this.prisma.product.findFirst({
        where: { asin: product.asin },
        select: { id: true },
      })
      if (byAsin) return byAsin
    }

    // Strategy 2: Check by sourceItemId (eBay itemId, etc.)
    if (product.sourceItemId) {
      const bySourceId = await this.prisma.product.findFirst({
        where: { sourceItemId: product.sourceItemId },
        select: { id: true },
      })
      if (bySourceId) return bySourceId
    }

    // Strategy 3: Check by urlCanonical
    if (product.urlCanonical) {
      const byUrl = await this.prisma.product.findFirst({
        where: { urlCanonical: product.urlCanonical },
        select: { id: true },
      })
      if (byUrl) return byUrl
    }

    // Strategy 4: Check by exact title match + similar price (within 10%)
    const byTitle = await this.prisma.product.findFirst({
      where: {
        title: product.title,
        price: {
          gte: product.price * 0.9,
          lte: product.price * 1.1,
        },
      },
      select: { id: true },
    })
    if (byTitle) return byTitle

    return null
  }

  /**
   * Get or create merchant
   */
  private async getOrCreateMerchant(product: BaseProduct) {
    const domain = product.merchantDomain.replace(/^www\./, '')
    
    let merchant = await this.prisma.merchant.findUnique({
      where: { domain },
    })

    if (!merchant) {
      merchant = await this.prisma.merchant.create({
        data: {
          name: product.retailer,
          domain,
          affiliateProgram: product.affiliateProgram,
        },
      })
    }

    return merchant
  }

  /**
   * Get ingestion statistics
   */
  async getStats() {
    const total = await this.prisma.product.count()
    const approved = await this.prisma.product.count({
      where: { status: ProductStatus.APPROVED },
    })
    const pending = await this.prisma.product.count({
      where: { status: ProductStatus.PENDING },
    })
    const rejected = await this.prisma.product.count({
      where: { status: ProductStatus.REJECTED },
    })

    const avgQuality = await this.prisma.product.aggregate({
      _avg: { qualityScore: true },
    })

    const withImages = await this.prisma.product.count({
      where: {
        images: { isEmpty: false },
      },
    })

    const withShipping = await this.prisma.product.count({
      where: {
        OR: [
          { freeShipping: true },
          { shippingCost: { not: null } },
        ],
      },
    })

    const withDelivery = await this.prisma.product.count({
      where: {
        deliveryDays: { not: null },
      },
    })

    const inStock = await this.prisma.product.count({
      where: { inStock: true },
    })

    return {
      total,
      approved,
      pending,
      rejected,
      avgQuality: avgQuality._avg.qualityScore || 0,
      dataCompleteness: {
        withImages: total > 0 ? (withImages / total) * 100 : 0,
        withShipping: total > 0 ? (withShipping / total) * 100 : 0,
        withDelivery: total > 0 ? (withDelivery / total) * 100 : 0,
        inStock: total > 0 ? (inStock / total) * 100 : 0,
      },
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    await this.prisma.$disconnect()
  }

  private calculateRecencyScore(listingStartAt?: string): number {
    if (!listingStartAt) return 0
    const start = new Date(listingStartAt).getTime()
    const now = Date.now()
    const days = (now - start) / (1000 * 60 * 60 * 24)
    if (Number.isNaN(days)) return 0
    if (days <= 0) return 1
    if (days > 30) return 0
    return Math.max(0, 1 - days / 30)
  }

  private normalizeTags(tags?: Array<ProductTagInput | string>): ProductTagInput[] {
    if (!tags || tags.length === 0) return []
    return tags
      .map((tag) => (typeof tag === 'string' ? { tag, weight: 1 } : { tag: tag.tag, weight: tag.weight ?? 1 }))
      .filter((t) => t.tag && t.tag.trim().length > 0)
  }

  private normalizeRegionLinks(
    links: ProductRegionLinkInput[] | undefined,
    fallbackUrl: string,
    fallbackCurrency?: string
  ): ProductRegionLinkInput[] {
    if (!links || links.length === 0) return []
    return links
      .map((link) => ({
        country: link.country,
        affiliateUrl: link.affiliateUrl || fallbackUrl,
        currency: link.currency || fallbackCurrency,
        marketplaceId: link.marketplaceId,
      }))
      .filter((link) => link.country && link.affiliateUrl)
  }

  private buildCreateData(
    data: Prisma.ProductUncheckedCreateInput,
    embedding: number[],
  ): Prisma.ProductUncheckedCreateInput {
    return {
      ...data,
      embedding: embedding.length ? embedding : [],
    }
  }

  private buildUpdateData(
    data: Prisma.ProductUncheckedUpdateInput,
    embedding: number[],
  ): Prisma.ProductUncheckedUpdateInput {
    return {
      ...data,
      embedding: embedding.length ? embedding : [],
    }
  }
}


/**
 * Robust Ingestion Engine
 * Handles quality scoring, deduplication, database operations, and logging
 */

import { PrismaClient, ProductStatus, Prisma } from '@prisma/client'
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

  constructor(overrides?: { prisma?: PrismaClient; openai?: OpenAI }) {
    if (overrides?.prisma) {
      this.prisma = overrides.prisma
    } else if (process.env.DATABASE_URL) {
      this.prisma = new PrismaClient()
    } else {
      // Minimal stub to satisfy tests when prisma is injected
      this.prisma = {} as unknown as PrismaClient
    }
    this.openai =
      overrides?.openai ||
      new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })
  }

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
        const embedding = await this.generateEmbedding(product)
        const finalQualityScore = this.calculateFinalQualityScore(
          product,
          embedding.length > 0
        )
        const status =
          finalQualityScore >= 0.8
            ? ProductStatus.APPROVED
            : finalQualityScore >= 0.6
              ? ProductStatus.PENDING
              : ProductStatus.REJECTED
        const existing = await this.findDuplicate(product)
        const merchant = await this.getOrCreateMerchant(product)

        const dataToSave = {
          title: product.title,
          description: product.description,
          shortDescription:
            product.shortDescription || product.title.slice(0, 150),
          price: product.price,
          originalPrice: product.originalPrice,
          discountPercent: product.discountPercent,
          currency: product.currency,
          images:
            product.images || (product.imageUrl ? [product.imageUrl] : []),
          imagesThumbnail:
            product.imagesThumbnail ||
            (product.imageUrl ? [product.imageUrl] : []),
          affiliateUrl: product.affiliateUrl || product.url,
          categories: product.categories || [],
          status,
          source: product.source,
          retailer: product.retailer || product.brand,
          availability: product.availability,
          brand: product.brand,
          asin: product.asin,
          affiliateProgram: product.affiliateProgram,
          urlCanonical: product.urlCanonical || product.url,
          qualityScore: finalQualityScore,
          recencyScore:
            product.recencyScore ??
            this.calculateRecencyScore(product.listingStartAt),
          popularityScore: product.popularityScore ?? 0,
          lastSeenAt: new Date(),
          rating: product.rating,
          numReviews: product.numReviews,
          shippingCost: product.shippingCost,
          freeShipping: product.freeShipping,
          deliveryDays: product.deliveryDays,
          deliveryMin: product.deliveryMin,
          deliveryMax: product.deliveryMax,
          primeEligible: product.primeEligible,
          inStock: product.inStock,
          stockQuantity: product.stockQuantity,
          expiresAt: product.listingEndAt
            ? new Date(product.listingEndAt)
            : product.expiresAt
              ? new Date(product.expiresAt)
              : null,
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

        if (existing) {
          await this.prisma.product.update({
            where: { id: existing.id },
            data: this.buildUpdateData(
              {
                ...dataToSave,
                merchant: merchant
                  ? { connect: { id: merchant.id } }
                  : undefined,
              } as any,
              embedding
            ),
          })
          result.updated++
        } else {
          await this.prisma.product.create({
            data: this.buildCreateData(
              {
                ...dataToSave,
                merchant: merchant
                  ? { connect: { id: merchant.id } }
                  : undefined,
              } as any,
              embedding
            ),
          })
          result.created++
        }

        result.products.push(product)
        await new Promise((resolve) => setTimeout(resolve, 1))
      } catch (error) {
        result.errors++
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error'
        result.errorMessages.push(`${product.title}: ${errorMsg}`)
      }
    }

    result.duration = Date.now() - startTime
    // Mark success if we created or updated at least one product
    result.success =
      result.created + result.updated > 0 && result.errors < products.length
    return result
  }

  // Exposed for some integration tests that call createProduct directly
  async createProduct(
    product: BaseProduct,
    embedding: number[],
    tags: ProductTagInput[],
    regionLinks: ProductRegionLinkInput[],
    merchant: { id: string } | null
  ) {
    const data = this.buildCreateData(
      {
        title: product.title,
        description: product.description,
        shortDescription:
          product.shortDescription || product.title.slice(0, 150),
        price: product.price,
        currency: product.currency,
        images: product.images || (product.imageUrl ? [product.imageUrl] : []),
        imagesThumbnail:
          product.imagesThumbnail ||
          (product.imageUrl ? [product.imageUrl] : []),
        affiliateUrl: product.affiliateUrl || product.url,
        categories: product.categories || [],
        status: ProductStatus.PENDING,
        source: product.source,
        retailer: product.retailer || product.brand,
        availability: product.availability,
        brand: product.brand,
        asin: product.asin,
        affiliateProgram: product.affiliateProgram,
        urlCanonical: product.urlCanonical || product.url,
        qualityScore: product.qualityScore || 0.6,
        lastSeenAt: new Date(),
        sourceItemId: product.sourceItemId,
        merchant: merchant ? { connect: { id: merchant.id } } : undefined,
      } as any,
      embedding
    )
    return this.prisma.product.create({ data } as any)
  }

  private async generateEmbedding(product: BaseProduct): Promise<number[]> {
    try {
      const cats = Array.isArray(product.categories) ? product.categories : []
      const text =
        `${product.title} ${product.description ?? ''} ${cats.join(' ')}`.slice(
          0,
          1500
        )
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      })
      return response.data[0].embedding as unknown as number[]
    } catch (error) {
      return []
    }
  }

  private calculateFinalQualityScore(
    product: BaseProduct,
    hasEmbedding: boolean
  ): number {
    let score = product.qualityScore ?? 0.6
    if (hasEmbedding) score += 0.15
    return Math.min(score, 1.0)
  }

  private async findDuplicate(
    product: BaseProduct
  ): Promise<{ id: string } | null> {
    const productApi = (this.prisma as any).product
    if (!productApi?.findFirst) return null
    // Strategy 1: Check by ASIN (Amazon)
    if (product.asin) {
      const byAsin = await productApi.findFirst({
        where: { asin: product.asin },
        select: { id: true },
      })
      if (byAsin) return byAsin
    }

    // Strategy 2: Check by sourceItemId (eBay itemId, etc.)
    if (product.sourceItemId) {
      const bySourceId = await productApi.findFirst({
        where: { sourceItemId: product.sourceItemId },
        select: { id: true },
      })
      if (bySourceId) return bySourceId
    }

    // Strategy 3: Check by urlCanonical
    if (product.urlCanonical) {
      const byUrl = await productApi.findFirst({
        where: { urlCanonical: product.urlCanonical },
        select: { id: true },
      })
      if (byUrl) return byUrl
    }

    // Strategy 4: Check by exact title match + similar price (within 10%)
    const byTitle = await productApi.findFirst({
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

  private async getOrCreateMerchant(product: BaseProduct) {
    try {
      const rawDomain =
        product.merchantDomain ||
        (product.url ? new URL(product.url).hostname : '')
      const domain = (rawDomain || '').replace(/^www\./, '')
      if (!domain) return null

      const findUnique = (this.prisma as any).merchant?.findUnique
      const findFirst = (this.prisma as any).merchant?.findFirst

      let merchant = findUnique
        ? await (this.prisma as any).merchant.findUnique({ where: { domain } })
        : findFirst
          ? await (this.prisma as any).merchant.findFirst({ where: { domain } })
          : null

      if (!merchant && (this.prisma as any).merchant?.create) {
        merchant = await (this.prisma as any).merchant.create({
          data: {
            name: product.retailer || domain,
            domain,
            affiliateProgram: product.affiliateProgram,
          },
        })
      }
      return merchant || null
    } catch {
      return null
    }
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
        OR: [{ freeShipping: true }, { shippingCost: { not: null } }],
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

  async disconnect() {
    if ((this.prisma as any).$disconnect)
      await (this.prisma as any).$disconnect()
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

  private normalizeTags(
    tags?: Array<ProductTagInput | string>
  ): ProductTagInput[] {
    if (!tags || tags.length === 0) return []
    return tags
      .map((tag) =>
        typeof tag === 'string'
          ? { tag, weight: 1 }
          : { tag: tag.tag, weight: tag.weight ?? 1 }
      )
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
    embedding: number[]
  ): Prisma.ProductUncheckedCreateInput {
    return {
      ...data,
      embedding: embedding.length ? embedding : [],
    }
  }

  private buildUpdateData(
    data: Prisma.ProductUncheckedUpdateInput,
    embedding: number[]
  ): Prisma.ProductUncheckedUpdateInput {
    return {
      ...data,
      embedding: embedding.length ? embedding : [],
    }
  }
}

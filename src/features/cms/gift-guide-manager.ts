import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Gift Guide Management System
interface GiftGuideInput {
  title: string
  slug: string
  description: string
  category: string
  occasion?: string
  targetAudience?: string
  products?: string[]
  featuredProducts?: string[]
  seasonal?: boolean
  budget?: string
  tags?: string[]
  seoTitle?: string
  seoDescription?: string
  publishedAt?: Date
}

interface GiftGuideUpdateInput extends Partial<GiftGuideInput> {
  id: string
}

interface GiftGuideFilters {
  category?: string
  occasion?: string
  seasonal?: boolean
  budget?: string
  tags?: string[]
  published?: boolean
  search?: string
  limit?: number
  offset?: number
}

interface GiftGuideRecommendation {
  id: string
  title: string
  description: string
  category: string
  occasion?: string
  targetAudience?: string
  products: Array<{
    id: string
    title: string
    price: number
    images: string[]
    affiliateUrl: string
    rating?: number
    brand?: string
  }>
  featuredProducts: Array<{
    id: string
    title: string
    price: number
    images: string[]
    affiliateUrl: string
    rating?: number
    brand?: string
  }>
  budget?: string
  tags: string[]
  views: number
  shares: number
  publishedAt: Date
}

class GiftGuideManager {
  // Gift Guide CRUD operations
  async createGiftGuide(input: GiftGuideInput) {
    try {
      const giftGuide = await prisma.giftGuide.create({
        data: {
          ...input,
          slug: this.generateSlug(input.slug || input.title),
        },
      })

      return giftGuide
    } catch (error) {
      console.error('Error creating gift guide:', error)
      throw error
    }
  }

  async updateGiftGuide(input: GiftGuideUpdateInput) {
    try {
      const giftGuide = await prisma.giftGuide.update({
        where: { id: input.id },
        data: {
          ...input,
          slug: input.slug ? this.generateSlug(input.slug) : undefined,
        },
      })

      return giftGuide
    } catch (error) {
      console.error('Error updating gift guide:', error)
      throw error
    }
  }

  async getGiftGuide(id: string) {
    try {
      const giftGuide = await prisma.giftGuide.findUnique({
        where: { id },
      })

      if (!giftGuide) return null

      // Get product details
      const products = await this.getGuideProducts(giftGuide.products)
      const featuredProducts = await this.getGuideProducts(
        giftGuide.featuredProducts
      )

      return {
        ...giftGuide,
        products,
        featuredProducts,
      }
    } catch (error) {
      console.error('Error getting gift guide:', error)
      throw error
    }
  }

  async getGiftGuideBySlug(slug: string) {
    try {
      const giftGuide = await prisma.giftGuide.findUnique({
        where: { slug },
      })

      if (!giftGuide) return null

      // Get product details
      const products = await this.getGuideProducts(giftGuide.products)
      const featuredProducts = await this.getGuideProducts(
        giftGuide.featuredProducts
      )

      return {
        ...giftGuide,
        products,
        featuredProducts,
      }
    } catch (error) {
      console.error('Error getting gift guide by slug:', error)
      throw error
    }
  }

  async listGiftGuides(filters: GiftGuideFilters = {}) {
    try {
      const where: any = {}

      if (filters.category) where.category = filters.category
      if (filters.occasion) where.occasion = filters.occasion
      if (filters.seasonal !== undefined) where.seasonal = filters.seasonal
      if (filters.budget) where.budget = filters.budget
      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags }
      }
      if (filters.published) {
        where.publishedAt = { not: null }
      }
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { tags: { hasSome: [filters.search] } },
        ]
      }

      const giftGuides = await prisma.giftGuide.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: filters.limit || 20,
        skip: filters.offset || 0,
      })

      return giftGuides
    } catch (error) {
      console.error('Error listing gift guides:', error)
      throw error
    }
  }

  async deleteGiftGuide(id: string) {
    try {
      await prisma.giftGuide.delete({
        where: { id },
      })

      return { success: true }
    } catch (error) {
      console.error('Error deleting gift guide:', error)
      throw error
    }
  }

  // Product management for gift guides
  async addProductsToGuide(guideId: string, productIds: string[]) {
    try {
      const guide = await prisma.giftGuide.findUnique({
        where: { id: guideId },
      })

      if (!guide) throw new Error('Gift guide not found')

      const updatedProducts = [...new Set([...guide.products, ...productIds])]

      const updatedGuide = await prisma.giftGuide.update({
        where: { id: guideId },
        data: { products: updatedProducts },
      })

      return updatedGuide
    } catch (error) {
      console.error('Error adding products to guide:', error)
      throw error
    }
  }

  async removeProductsFromGuide(guideId: string, productIds: string[]) {
    try {
      const guide = await prisma.giftGuide.findUnique({
        where: { id: guideId },
      })

      if (!guide) throw new Error('Gift guide not found')

      const updatedProducts = guide.products.filter(
        (id) => !productIds.includes(id)
      )

      const updatedGuide = await prisma.giftGuide.update({
        where: { id: guideId },
        data: { products: updatedProducts },
      })

      return updatedGuide
    } catch (error) {
      console.error('Error removing products from guide:', error)
      throw error
    }
  }

  async setFeaturedProducts(guideId: string, productIds: string[]) {
    try {
      const guide = await prisma.giftGuide.findUnique({
        where: { id: guideId },
      })

      if (!guide) throw new Error('Gift guide not found')

      // Ensure featured products are also in the main products list
      const updatedProducts = [...new Set([...guide.products, ...productIds])]

      const updatedGuide = await prisma.giftGuide.update({
        where: { id: guideId },
        data: {
          products: updatedProducts,
          featuredProducts: productIds,
        },
      })

      return updatedGuide
    } catch (error) {
      console.error('Error setting featured products:', error)
      throw error
    }
  }

  // Analytics operations
  async trackGuideView(guideId: string) {
    try {
      await prisma.giftGuide.update({
        where: { id: guideId },
        data: {
          views: { increment: 1 },
        },
      })
    } catch (error) {
      console.error('Error tracking guide view:', error)
    }
  }

  async trackGuideShare(guideId: string) {
    try {
      await prisma.giftGuide.update({
        where: { id: guideId },
        data: {
          shares: { increment: 1 },
        },
      })
    } catch (error) {
      console.error('Error tracking guide share:', error)
    }
  }

  // Utility functions
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  private async getGuideProducts(productIds: string[]) {
    if (productIds.length === 0) return []

    try {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          status: 'APPROVED',
          inStock: true,
        },
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          affiliateUrl: true,
          rating: true,
          brand: true,
          currency: true,
        },
      })

      return products
    } catch (error) {
      console.error('Error getting guide products:', error)
      return []
    }
  }

  // Recommendation system
  async getRecommendedGuides(
    userPreferences: {
      interests?: string[]
      occasion?: string
      budget?: string
      ageRange?: string
      gender?: string
    },
    limit: number = 5
  ) {
    try {
      const where: any = {
        publishedAt: { not: null },
      }

      // Filter by occasion if provided
      if (userPreferences.occasion) {
        where.occasion = userPreferences.occasion
      }

      // Filter by budget if provided
      if (userPreferences.budget) {
        where.budget = userPreferences.budget
      }

      // Filter by tags/interests if provided
      if (userPreferences.interests && userPreferences.interests.length > 0) {
        where.tags = { hasSome: userPreferences.interests }
      }

      const guides = await prisma.giftGuide.findMany({
        where,
        orderBy: [{ views: 'desc' }, { shares: 'desc' }],
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting recommended guides:', error)
      throw error
    }
  }

  async getPopularGuides(limit: number = 10) {
    try {
      const guides = await prisma.giftGuide.findMany({
        where: {
          publishedAt: { not: null },
        },
        orderBy: [{ views: 'desc' }, { shares: 'desc' }],
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting popular guides:', error)
      throw error
    }
  }

  async getSeasonalGuides(limit: number = 10) {
    try {
      const guides = await prisma.giftGuide.findMany({
        where: {
          publishedAt: { not: null },
          seasonal: true,
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting seasonal guides:', error)
      throw error
    }
  }

  async getGuidesByCategory(category: string, limit: number = 10) {
    try {
      const guides = await prisma.giftGuide.findMany({
        where: {
          publishedAt: { not: null },
          category,
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting guides by category:', error)
      throw error
    }
  }

  async getGuidesByOccasion(occasion: string, limit: number = 10) {
    try {
      const guides = await prisma.giftGuide.findMany({
        where: {
          publishedAt: { not: null },
          occasion,
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting guides by occasion:', error)
      throw error
    }
  }

  async getGuidesByBudget(budget: string, limit: number = 10) {
    try {
      const guides = await prisma.giftGuide.findMany({
        where: {
          publishedAt: { not: null },
          budget,
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
      })

      return guides
    } catch (error) {
      console.error('Error getting guides by budget:', error)
      throw error
    }
  }

  // Content generation
  async generateGiftGuide(
    category: string,
    occasion?: string,
    budget?: string
  ) {
    try {
      // Get products for the category
      const products = await prisma.product.findMany({
        where: {
          categories: { has: category },
          status: 'APPROVED',
          inStock: true,
          ...(budget && this.getBudgetFilter(budget)),
        },
        orderBy: { qualityScore: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          price: true,
          images: true,
          affiliateUrl: true,
          rating: true,
          brand: true,
        },
      })

      if (products.length === 0) {
        throw new Error(`No products found for category: ${category}`)
      }

      // Generate guide content
      const title = this.generateGuideTitle(category, occasion, budget)
      const description = this.generateGuideDescription(
        category,
        occasion,
        budget,
        products.length
      )
      const slug = this.generateSlug(title)
      const tags = this.generateGuideTags(category, occasion, budget)

      // Create the gift guide
      const giftGuide = await this.createGiftGuide({
        title,
        slug,
        description,
        category,
        occasion,
        budget,
        products: products.map((p) => p.id),
        featuredProducts: products.slice(0, 5).map((p) => p.id),
        tags,
        publishedAt: new Date(),
      })

      return giftGuide
    } catch (error) {
      console.error('Error generating gift guide:', error)
      throw error
    }
  }

  private getBudgetFilter(budget: string) {
    switch (budget) {
      case 'under-50':
        return { price: { lte: 50 } }
      case '50-100':
        return { price: { gte: 50, lte: 100 } }
      case '100-200':
        return { price: { gte: 100, lte: 200 } }
      case '200-500':
        return { price: { gte: 200, lte: 500 } }
      case 'over-500':
        return { price: { gte: 500 } }
      default:
        return {}
    }
  }

  private generateGuideTitle(
    category: string,
    occasion?: string,
    budget?: string
  ): string {
    let title = `Best ${category} Gifts`

    if (occasion) {
      title = `${occasion} ${title}`
    }

    if (budget) {
      const budgetText = budget
        .replace('-', ' ')
        .replace('under', 'Under $')
        .replace('over', 'Over $')
      title = `${title} ${budgetText}`
    }

    return title
  }

  private generateGuideDescription(
    category: string,
    occasion?: string,
    budget?: string,
    productCount: number = 0
  ): string {
    let description = `Discover the perfect ${category} gifts`

    if (occasion) {
      description = `Find the best ${occasion} ${category} gifts`
    }

    if (budget) {
      const budgetText = budget
        .replace('-', ' ')
        .replace('under', 'under $')
        .replace('over', 'over $')
      description = `${description} ${budgetText}`
    }

    description = `${description}. Our curated selection features ${productCount} hand-picked items that are sure to delight.`

    return description
  }

  private generateGuideTags(
    category: string,
    occasion?: string,
    budget?: string
  ): string[] {
    const tags = [category.toLowerCase()]

    if (occasion) {
      tags.push(occasion.toLowerCase())
    }

    if (budget) {
      tags.push(budget.toLowerCase())
    }

    tags.push('gifts', 'recommendations', 'curated')

    return tags
  }
}

export {
  GiftGuideManager,
  GiftGuideInput,
  GiftGuideUpdateInput,
  GiftGuideFilters,
  GiftGuideRecommendation,
}

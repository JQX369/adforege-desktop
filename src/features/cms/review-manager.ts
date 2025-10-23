import { PrismaClient, ReviewStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Review Management System
interface ReviewInput {
  productId: string
  userId?: string
  contentId?: string
  rating: number
  title?: string
  reviewText: string
  pros?: string[]
  cons?: string[]
  verified?: boolean
}

interface ReviewUpdateInput extends Partial<ReviewInput> {
  id: string
}

interface ReviewFilters {
  productId?: string
  userId?: string
  contentId?: string
  rating?: number
  status?: ReviewStatus
  verified?: boolean
  limit?: number
  offset?: number
}

interface ReviewAnalytics {
  totalReviews: number
  averageRating: number
  ratingDistribution: Record<number, number>
  verifiedReviews: number
  recentReviews: number
}

class ReviewManager {
  // Review CRUD operations
  async createReview(input: ReviewInput) {
    try {
      const review = await prisma.productReview.create({
        data: {
          ...input,
          status: 'PENDING', // Moderation required
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
      })

      // Update product rating if review is approved
      if (review.status === 'APPROVED') {
        await this.updateProductRating(review.productId)
      }

      return review
    } catch (error) {
      console.error('Error creating review:', error)
      throw error
    }
  }

  async updateReview(input: ReviewUpdateInput) {
    try {
      const review = await prisma.productReview.update({
        where: { id: input.id },
        data: input,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
      })

      // Update product rating if review status changed
      if (input.status) {
        await this.updateProductRating(review.productId)
      }

      return review
    } catch (error) {
      console.error('Error updating review:', error)
      throw error
    }
  }

  async getReview(id: string) {
    try {
      const review = await prisma.productReview.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
      })

      return review
    } catch (error) {
      console.error('Error getting review:', error)
      throw error
    }
  }

  async listReviews(filters: ReviewFilters = {}) {
    try {
      const where: any = {}

      if (filters.productId) where.productId = filters.productId
      if (filters.userId) where.userId = filters.userId
      if (filters.contentId) where.contentId = filters.contentId
      if (filters.rating) where.rating = filters.rating
      if (filters.status) where.status = filters.status
      if (filters.verified !== undefined) where.verified = filters.verified

      const reviews = await prisma.productReview.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      })

      return reviews
    } catch (error) {
      console.error('Error listing reviews:', error)
      throw error
    }
  }

  async deleteReview(id: string) {
    try {
      const review = await prisma.productReview.findUnique({
        where: { id },
        select: { productId: true },
      })

      await prisma.productReview.delete({
        where: { id },
      })

      // Update product rating after deletion
      if (review) {
        await this.updateProductRating(review.productId)
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting review:', error)
      throw error
    }
  }

  // Review moderation
  async moderateReview(
    reviewId: string,
    decision: 'APPROVE' | 'REJECT' | 'FLAG'
  ) {
    try {
      const review = await prisma.productReview.update({
        where: { id: reviewId },
        data: {
          status:
            decision === 'APPROVE'
              ? 'APPROVED'
              : decision === 'REJECT'
                ? 'REJECTED'
                : 'FLAGGED',
        },
        include: {
          product: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      // Update product rating if review was approved
      if (decision === 'APPROVE') {
        await this.updateProductRating(review.productId)
      }

      return review
    } catch (error) {
      console.error('Error moderating review:', error)
      throw error
    }
  }

  async getPendingReviews(limit: number = 50) {
    try {
      const reviews = await prisma.productReview.findMany({
        where: { status: 'PENDING' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })

      return reviews
    } catch (error) {
      console.error('Error getting pending reviews:', error)
      throw error
    }
  }

  async getFlaggedReviews(limit: number = 50) {
    try {
      const reviews = await prisma.productReview.findMany({
        where: { status: 'FLAGGED' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      })

      return reviews
    } catch (error) {
      console.error('Error getting flagged reviews:', error)
      throw error
    }
  }

  // Review analytics
  async getProductReviewAnalytics(productId: string): Promise<ReviewAnalytics> {
    try {
      const reviews = await prisma.productReview.findMany({
        where: {
          productId,
          status: 'APPROVED',
        },
        select: {
          rating: true,
          verified: true,
          createdAt: true,
        },
      })

      const totalReviews = reviews.length
      const averageRating =
        totalReviews > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            totalReviews
          : 0

      const ratingDistribution: Record<number, number> = {}
      for (let i = 1; i <= 5; i++) {
        ratingDistribution[i] = reviews.filter((r) => r.rating === i).length
      }

      const verifiedReviews = reviews.filter((r) => r.verified).length
      const recentReviews = reviews.filter((r) => {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return r.createdAt >= thirtyDaysAgo
      }).length

      return {
        totalReviews,
        averageRating,
        ratingDistribution,
        verifiedReviews,
        recentReviews,
      }
    } catch (error) {
      console.error('Error getting product review analytics:', error)
      throw error
    }
  }

  async getReviewAnalytics(userId: string) {
    try {
      const reviews = await prisma.productReview.findMany({
        where: { userId },
        select: {
          rating: true,
          status: true,
          createdAt: true,
          helpful: true,
        },
      })

      const totalReviews = reviews.length
      const approvedReviews = reviews.filter(
        (r) => r.status === 'APPROVED'
      ).length
      const pendingReviews = reviews.filter(
        (r) => r.status === 'PENDING'
      ).length
      const rejectedReviews = reviews.filter(
        (r) => r.status === 'REJECTED'
      ).length
      const averageRating =
        totalReviews > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) /
            totalReviews
          : 0
      const totalHelpful = reviews.reduce(
        (sum, review) => sum + review.helpful,
        0
      )

      return {
        totalReviews,
        approvedReviews,
        pendingReviews,
        rejectedReviews,
        averageRating,
        totalHelpful,
      }
    } catch (error) {
      console.error('Error getting review analytics:', error)
      throw error
    }
  }

  // Review helpfulness
  async markReviewHelpful(reviewId: string) {
    try {
      const review = await prisma.productReview.update({
        where: { id: reviewId },
        data: {
          helpful: { increment: 1 },
        },
      })

      return review
    } catch (error) {
      console.error('Error marking review helpful:', error)
      throw error
    }
  }

  async markReviewNotHelpful(reviewId: string) {
    try {
      const review = await prisma.productReview.update({
        where: { id: reviewId },
        data: {
          helpful: { decrement: 1 },
        },
      })

      return review
    } catch (error) {
      console.error('Error marking review not helpful:', error)
      throw error
    }
  }

  // Utility functions
  private async updateProductRating(productId: string) {
    try {
      const reviews = await prisma.productReview.findMany({
        where: {
          productId,
          status: 'APPROVED',
        },
        select: {
          rating: true,
        },
      })

      if (reviews.length === 0) return

      const averageRating =
        reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length

      await prisma.product.update({
        where: { id: productId },
        data: {
          rating: averageRating,
          numReviews: reviews.length,
        },
      })
    } catch (error) {
      console.error('Error updating product rating:', error)
    }
  }

  // Review validation
  async validateReview(
    input: ReviewInput
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, status: true },
    })

    if (!product) {
      errors.push('Product not found')
    } else if (product.status !== 'APPROVED') {
      errors.push('Product is not available for review')
    }

    // Check if user already reviewed this product
    if (input.userId) {
      const existingReview = await prisma.productReview.findFirst({
        where: {
          productId: input.productId,
          userId: input.userId,
          status: { in: ['APPROVED', 'PENDING'] },
        },
      })

      if (existingReview) {
        errors.push('You have already reviewed this product')
      }
    }

    // Validate rating
    if (input.rating < 1 || input.rating > 5) {
      errors.push('Rating must be between 1 and 5')
    }

    // Validate content
    if (!input.reviewText || input.reviewText.trim().length < 10) {
      errors.push('Review content must be at least 10 characters long')
    }

    if (input.reviewText && input.reviewText.length > 1000) {
      errors.push('Review content must be less than 1000 characters')
    }

    // Validate title
    if (input.title && input.title.length > 200) {
      errors.push('Review title must be less than 200 characters')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  // Review search
  async searchReviews(query: string, filters: ReviewFilters = {}) {
    try {
      const where: any = {
        status: 'APPROVED',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { reviewText: { contains: query, mode: 'insensitive' } },
          { pros: { hasSome: [query] } },
          { cons: { hasSome: [query] } },
        ],
      }

      // Apply additional filters
      if (filters.productId) where.productId = filters.productId
      if (filters.userId) where.userId = filters.userId
      if (filters.rating) where.rating = filters.rating
      if (filters.verified !== undefined) where.verified = filters.verified

      const reviews = await prisma.productReview.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        orderBy: [{ helpful: 'desc' }, { createdAt: 'desc' }],
        take: filters.limit || 50,
        skip: filters.offset || 0,
      })

      return reviews
    } catch (error) {
      console.error('Error searching reviews:', error)
      throw error
    }
  }

  // Review recommendations
  async getRecommendedReviews(productId: string, limit: number = 5) {
    try {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { categories: true },
      })

      if (!product) return []

      const reviews = await prisma.productReview.findMany({
        where: {
          status: 'APPROVED',
          product: {
            categories: { hasSome: product.categories },
          },
          productId: { not: productId },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          product: {
            select: {
              id: true,
              title: true,
              images: true,
            },
          },
        },
        orderBy: [{ helpful: 'desc' }, { rating: 'desc' }],
        take: limit,
      })

      return reviews
    } catch (error) {
      console.error('Error getting recommended reviews:', error)
      throw error
    }
  }
}

export {
  ReviewManager,
  ReviewInput,
  ReviewUpdateInput,
  ReviewFilters,
  ReviewAnalytics,
}

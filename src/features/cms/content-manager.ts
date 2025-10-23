import {
  PrismaClient,
  ContentStatus,
  ContentType,
  CommentStatus,
} from '@prisma/client'

const prisma = new PrismaClient()

// Content Management System
interface ContentInput {
  title: string
  slug: string
  description?: string
  content: string
  excerpt?: string
  type: ContentType
  status?: ContentStatus
  authorId?: string
  featuredImage?: string
  tags?: string[]
  categories?: string[]
  seoTitle?: string
  seoDescription?: string
  metaKeywords?: string[]
  publishedAt?: Date
  scheduledAt?: Date
}

interface ContentUpdateInput extends Partial<ContentInput> {
  id: string
}

interface ContentFilters {
  type?: ContentType
  status?: ContentStatus
  authorId?: string
  tags?: string[]
  categories?: string[]
  published?: boolean
  search?: string
  limit?: number
  offset?: number
}

interface CommentInput {
  contentId: string
  userId?: string
  parentId?: string
  text: string
}

interface CommentFilters {
  contentId?: string
  userId?: string
  status?: CommentStatus
  limit?: number
  offset?: number
}

class ContentManager {
  // Content CRUD operations
  async createContent(input: ContentInput) {
    try {
      const content = await prisma.content.create({
        data: {
          ...input,
          slug: this.generateSlug(input.slug || input.title),
          publishedAt:
            input.status === 'PUBLISHED' ? new Date() : input.publishedAt,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error creating content:', error)
      throw error
    }
  }

  async updateContent(input: ContentUpdateInput) {
    try {
      const content = await prisma.content.update({
        where: { id: input.id },
        data: {
          ...input,
          slug: input.slug ? this.generateSlug(input.slug) : undefined,
          publishedAt:
            input.status === 'PUBLISHED' ? new Date() : input.publishedAt,
        },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error updating content:', error)
      throw error
    }
  }

  async getContent(id: string) {
    try {
      const content = await prisma.content.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          comments: {
            where: { status: 'APPROVED' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
              replies: {
                where: { status: 'APPROVED' },
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting content:', error)
      throw error
    }
  }

  async getContentBySlug(slug: string) {
    try {
      const content = await prisma.content.findUnique({
        where: { slug },
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
          comments: {
            where: { status: 'APPROVED' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
              replies: {
                where: { status: 'APPROVED' },
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting content by slug:', error)
      throw error
    }
  }

  async listContent(filters: ContentFilters = {}) {
    try {
      const where: any = {}

      if (filters.type) where.type = filters.type
      if (filters.status) where.status = filters.status
      if (filters.authorId) where.authorId = filters.authorId
      if (filters.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags }
      }
      if (filters.categories && filters.categories.length > 0) {
        where.categories = { hasSome: filters.categories }
      }
      if (filters.published) {
        where.status = 'PUBLISHED'
        where.publishedAt = { lte: new Date() }
      }
      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } },
          { tags: { hasSome: [filters.search] } },
        ]
      }

      const content = await prisma.content.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: filters.limit || 20,
        skip: filters.offset || 0,
      })

      return content
    } catch (error) {
      console.error('Error listing content:', error)
      throw error
    }
  }

  async deleteContent(id: string) {
    try {
      await prisma.content.delete({
        where: { id },
      })

      return { success: true }
    } catch (error) {
      console.error('Error deleting content:', error)
      throw error
    }
  }

  // Comment operations
  async createComment(input: CommentInput) {
    try {
      const comment = await prisma.comment.create({
        data: input,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          content: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      return comment
    } catch (error) {
      console.error('Error creating comment:', error)
      throw error
    }
  }

  async updateCommentStatus(commentId: string, status: CommentStatus) {
    try {
      const comment = await prisma.comment.update({
        where: { id: commentId },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return comment
    } catch (error) {
      console.error('Error updating comment status:', error)
      throw error
    }
  }

  async listComments(filters: CommentFilters = {}) {
    try {
      const where: any = {}

      if (filters.contentId) where.contentId = filters.contentId
      if (filters.userId) where.userId = filters.userId
      if (filters.status) where.status = filters.status

      const comments = await prisma.comment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
          content: {
            select: {
              id: true,
              title: true,
            },
          },
          replies: {
            where: { status: 'APPROVED' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: filters.limit || 50,
        skip: filters.offset || 0,
      })

      return comments
    } catch (error) {
      console.error('Error listing comments:', error)
      throw error
    }
  }

  // Analytics operations
  async trackContentView(contentId: string) {
    try {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          views: { increment: 1 },
        },
      })

      // Track daily analytics
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      await prisma.contentAnalytics.upsert({
        where: {
          contentId_date: {
            contentId,
            date: today,
          },
        },
        update: {
          views: { increment: 1 },
        },
        create: {
          contentId,
          date: today,
          views: 1,
        },
      })
    } catch (error) {
      console.error('Error tracking content view:', error)
    }
  }

  async trackContentLike(contentId: string) {
    try {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          likes: { increment: 1 },
        },
      })
    } catch (error) {
      console.error('Error tracking content like:', error)
    }
  }

  async trackContentShare(contentId: string) {
    try {
      await prisma.content.update({
        where: { id: contentId },
        data: {
          shares: { increment: 1 },
        },
      })
    } catch (error) {
      console.error('Error tracking content share:', error)
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

  async getContentAnalytics(contentId: string, days: number = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const analytics = await prisma.contentAnalytics.findMany({
        where: {
          contentId,
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
      })

      return analytics
    } catch (error) {
      console.error('Error getting content analytics:', error)
      throw error
    }
  }

  async getPopularContent(limit: number = 10) {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
        },
        orderBy: [{ views: 'desc' }, { likes: 'desc' }, { shares: 'desc' }],
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting popular content:', error)
      throw error
    }
  }

  async getRecentContent(limit: number = 10) {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting recent content:', error)
      throw error
    }
  }

  async getContentByCategory(category: string, limit: number = 10) {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
          categories: { has: category },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting content by category:', error)
      throw error
    }
  }

  async getContentByTag(tag: string, limit: number = 10) {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { lte: new Date() },
          tags: { has: tag },
        },
        orderBy: { publishedAt: 'desc' },
        take: limit,
        include: {
          author: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })

      return content
    } catch (error) {
      console.error('Error getting content by tag:', error)
      throw error
    }
  }

  // Content scheduling
  async getScheduledContent() {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
        orderBy: { scheduledAt: 'asc' },
      })

      return content
    } catch (error) {
      console.error('Error getting scheduled content:', error)
      throw error
    }
  }

  async publishScheduledContent() {
    try {
      const scheduledContent = await this.getScheduledContent()

      for (const content of scheduledContent) {
        await prisma.content.update({
          where: { id: content.id },
          data: {
            status: 'PUBLISHED',
            publishedAt: new Date(),
          },
        })
      }

      return { published: scheduledContent.length }
    } catch (error) {
      console.error('Error publishing scheduled content:', error)
      throw error
    }
  }
}

export {
  ContentManager,
  ContentInput,
  ContentUpdateInput,
  ContentFilters,
  CommentInput,
  CommentFilters,
}

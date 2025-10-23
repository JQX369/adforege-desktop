import { PrismaClient, ContentType, ContentStatus } from '@prisma/client'
import { ContentManager } from './content-manager'
import { GiftGuideManager } from './gift-guide-manager'

const prisma = new PrismaClient()

// Content Automation System
interface AutomationConfig {
  blogPostFrequency: 'daily' | 'weekly' | 'monthly'
  giftGuideFrequency: 'weekly' | 'monthly'
  seasonalContent: boolean
  trendingTopics: boolean
  userGeneratedContent: boolean
  aiContentGeneration: boolean
}

interface ContentTemplate {
  id: string
  name: string
  type: ContentType
  template: string
  variables: string[]
  category: string
}

interface ScheduledContent {
  id: string
  type: ContentType
  title: string
  scheduledAt: Date
  status: 'pending' | 'processing' | 'completed' | 'failed'
  config: any
}

class ContentAutomation {
  private contentManager: ContentManager
  private giftGuideManager: GiftGuideManager
  private config: AutomationConfig

  constructor(config: Partial<AutomationConfig> = {}) {
    this.contentManager = new ContentManager()
    this.giftGuideManager = new GiftGuideManager()
    this.config = {
      blogPostFrequency: 'weekly',
      giftGuideFrequency: 'monthly',
      seasonalContent: true,
      trendingTopics: true,
      userGeneratedContent: true,
      aiContentGeneration: true,
      ...config,
    }
  }

  // Automated content generation
  async generateGiftGuide(
    category: string,
    occasion?: string,
    budget?: string
  ) {
    try {
      console.log(
        `🎁 Generating gift guide for ${category}${occasion ? ` - ${occasion}` : ''}${budget ? ` - ${budget}` : ''}`
      )

      const giftGuide = await this.giftGuideManager.generateGiftGuide(
        category,
        occasion,
        budget
      )

      console.log(`✅ Gift guide generated: ${giftGuide.title}`)
      return giftGuide
    } catch (error) {
      console.error('Error generating gift guide:', error)
      throw error
    }
  }

  async generateBlogPost(topic: string, category: string) {
    try {
      console.log(`📝 Generating blog post: ${topic}`)

      const title = this.generateBlogTitle(topic, category)
      const slug = this.generateSlug(title)
      const content = await this.generateBlogContent(topic, category)
      const excerpt = this.generateExcerpt(content)
      const tags = this.generateTags(topic, category)

      const blogPost = await this.contentManager.createContent({
        title,
        slug,
        description: excerpt,
        content,
        excerpt,
        type: 'BLOG_POST',
        status: 'PUBLISHED',
        categories: [category],
        tags,
        publishedAt: new Date(),
      })

      console.log(`✅ Blog post generated: ${title}`)
      return blogPost
    } catch (error) {
      console.error('Error generating blog post:', error)
      throw error
    }
  }

  async generateSeasonalContent() {
    try {
      console.log('🎄 Generating seasonal content...')

      const currentMonth = new Date().getMonth()
      const seasonalContent = []

      // Generate content based on current season
      switch (currentMonth) {
        case 11: // December
        case 0: // January
          seasonalContent.push(
            await this.generateGiftGuide('Holiday', 'Christmas', 'under-50'),
            await this.generateBlogPost('Christmas Gift Ideas', 'Holiday')
          )
          break
        case 1: // February
          seasonalContent.push(
            await this.generateGiftGuide(
              'Romance',
              "Valentine's Day",
              '50-100'
            ),
            await this.generateBlogPost("Valentine's Day Gifts", 'Romance')
          )
          break
        case 4: // May
          seasonalContent.push(
            await this.generateGiftGuide(
              "Mother's Day",
              "Mother's Day",
              '100-200'
            ),
            await this.generateBlogPost("Mother's Day Gift Guide", 'Family')
          )
          break
        case 5: // June
          seasonalContent.push(
            await this.generateGiftGuide(
              "Father's Day",
              "Father's Day",
              '100-200'
            ),
            await this.generateBlogPost("Father's Day Gifts", 'Family')
          )
          break
        case 8: // September
          seasonalContent.push(
            await this.generateGiftGuide(
              'Back to School',
              'Graduation',
              'under-50'
            ),
            await this.generateBlogPost(
              'Back to School Essentials',
              'Education'
            )
          )
          break
      }

      console.log(
        `✅ Generated ${seasonalContent.length} seasonal content pieces`
      )
      return seasonalContent
    } catch (error) {
      console.error('Error generating seasonal content:', error)
      throw error
    }
  }

  async generateTrendingContent() {
    try {
      console.log('📈 Generating trending content...')

      // Get trending categories from product data
      const trendingCategories = await this.getTrendingCategories()
      const trendingContent = []

      for (const category of trendingCategories.slice(0, 3)) {
        trendingContent.push(
          await this.generateGiftGuide(category.name),
          await this.generateBlogPost(
            `Best ${category.name} Gifts`,
            category.name
          )
        )
      }

      console.log(
        `✅ Generated ${trendingContent.length} trending content pieces`
      )
      return trendingContent
    } catch (error) {
      console.error('Error generating trending content:', error)
      throw error
    }
  }

  // Content scheduling
  async scheduleContent(content: ScheduledContent) {
    try {
      // Store scheduled content in database
      const scheduled = await prisma.content.create({
        data: {
          title: content.title,
          slug: this.generateSlug(content.title),
          content: '', // Will be generated when published
          type: content.type,
          status: 'SCHEDULED',
          scheduledAt: content.scheduledAt,
        },
      })

      console.log(
        `📅 Content scheduled: ${content.title} for ${content.scheduledAt}`
      )
      return scheduled
    } catch (error) {
      console.error('Error scheduling content:', error)
      throw error
    }
  }

  async processScheduledContent() {
    try {
      console.log('⏰ Processing scheduled content...')

      const scheduledContent = await this.contentManager.getScheduledContent()
      const processed = []

      for (const content of scheduledContent) {
        try {
          // Generate content based on type
          let generatedContent
          switch (content.type) {
            case 'BLOG_POST':
              generatedContent = await this.generateBlogPost(
                content.title,
                'General'
              )
              break
            case 'GIFT_GUIDE':
              generatedContent = await this.generateGiftGuide(
                content.title.split(' ')[1] || 'Gifts'
              )
              break
            default:
              continue
          }

          // Update the scheduled content
          await this.contentManager.updateContent({
            id: content.id,
            content: generatedContent.content,
            status: 'PUBLISHED',
            publishedAt: new Date(),
          })

          processed.push(content)
        } catch (error) {
          console.error(
            `Error processing scheduled content ${content.id}:`,
            error
          )
        }
      }

      console.log(`✅ Processed ${processed.length} scheduled content pieces`)
      return processed
    } catch (error) {
      console.error('Error processing scheduled content:', error)
      throw error
    }
  }

  // Content templates
  async createContentTemplate(template: ContentTemplate) {
    try {
      // Store template in database (simplified - would use a separate table)
      console.log(`📋 Content template created: ${template.name}`)
      return template
    } catch (error) {
      console.error('Error creating content template:', error)
      throw error
    }
  }

  async generateContentFromTemplate(
    templateId: string,
    variables: Record<string, string>
  ) {
    try {
      // Get template and generate content (simplified)
      const template = await this.getContentTemplate(templateId)
      if (!template) throw new Error('Template not found')

      let content = template.template
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }

      return content
    } catch (error) {
      console.error('Error generating content from template:', error)
      throw error
    }
  }

  // Content optimization
  async optimizeContentForSEO(contentId: string) {
    try {
      const content = await this.contentManager.getContent(contentId)
      if (!content) throw new Error('Content not found')

      // Generate SEO-optimized title and description
      const seoTitle = this.generateSEOTitle(content.title, content.categories)
      const seoDescription = this.generateSEODescription(
        content.description || content.excerpt || ''
      )
      const metaKeywords = this.generateMetaKeywords(
        content.tags,
        content.categories
      )

      await this.contentManager.updateContent({
        id: contentId,
        seoTitle,
        seoDescription,
        metaKeywords,
      })

      console.log(`🔍 SEO optimization completed for: ${content.title}`)
      return { seoTitle, seoDescription, metaKeywords }
    } catch (error) {
      console.error('Error optimizing content for SEO:', error)
      throw error
    }
  }

  async analyzeContentPerformance(contentId: string) {
    try {
      const analytics = await this.contentManager.getContentAnalytics(
        contentId,
        30
      )
      const content = await this.contentManager.getContent(contentId)

      if (!content) throw new Error('Content not found')

      const performance = {
        views: analytics.reduce((sum, day) => sum + day.views, 0),
        clicks: analytics.reduce((sum, day) => sum + day.clicks, 0),
        shares: analytics.reduce((sum, day) => sum + day.shares, 0),
        comments: analytics.reduce((sum, day) => sum + day.comments, 0),
        likes: analytics.reduce((sum, day) => sum + day.likes, 0),
        avgTimeOnPage:
          analytics.reduce((sum, day) => sum + day.timeOnPage, 0) /
          analytics.length,
      }

      // Generate recommendations
      const recommendations = this.generatePerformanceRecommendations(
        performance,
        content
      )

      return {
        performance,
        recommendations,
        analytics,
      }
    } catch (error) {
      console.error('Error analyzing content performance:', error)
      throw error
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

  private generateBlogTitle(topic: string, category: string): string {
    const templates = [
      `Best ${topic} for 2024`,
      `Ultimate Guide to ${topic}`,
      `${topic}: Everything You Need to Know`,
      `Top 10 ${topic} Recommendations`,
      `How to Choose the Perfect ${topic}`,
    ]

    return templates[Math.floor(Math.random() * templates.length)]
  }

  private async generateBlogContent(
    topic: string,
    category: string
  ): Promise<string> {
    // Simplified content generation - in a real implementation, this would use AI
    const content = `
# ${this.generateBlogTitle(topic, category)}

## Introduction

Finding the perfect ${topic.toLowerCase()} can be challenging, but we're here to help. Our expert team has curated the best options available, taking into account quality, value, and user satisfaction.

## What to Look For

When choosing ${topic.toLowerCase()}, consider these important factors:

- **Quality**: Look for well-made items from reputable brands
- **Value**: Consider the price-to-quality ratio
- **Reviews**: Check what other customers are saying
- **Warranty**: Ensure you're covered in case of issues

## Our Top Recommendations

Based on our research and customer feedback, here are our top picks:

### 1. Premium Option
For those who want the best quality and don't mind paying a bit more.

### 2. Best Value
Great quality at a reasonable price point.

### 3. Budget-Friendly
Excellent options that won't break the bank.

## Conclusion

Whether you're looking for premium quality or great value, there's a perfect ${topic.toLowerCase()} out there for you. Take your time to consider your needs and budget, and don't hesitate to reach out if you need help choosing.

## Frequently Asked Questions

**Q: How do I know which option is right for me?**
A: Consider your budget, needs, and how often you'll use the item.

**Q: Do you offer any guarantees?**
A: Yes, we stand behind all our recommendations with our satisfaction guarantee.

**Q: Can I return items if I'm not satisfied?**
A: Most retailers offer return policies, but check the specific terms before purchasing.
    `.trim()

    return content
  }

  private generateExcerpt(content: string): string {
    // Extract first paragraph or first 150 characters
    const firstParagraph = content.split('\n\n')[0]
    return firstParagraph.length > 150
      ? firstParagraph.substring(0, 150) + '...'
      : firstParagraph
  }

  private generateTags(topic: string, category: string): string[] {
    const baseTags = [
      topic.toLowerCase(),
      category.toLowerCase(),
      'gifts',
      'recommendations',
    ]
    const additionalTags = ['2024', 'best', 'top', 'guide', 'review']

    return [...baseTags, ...additionalTags.slice(0, 3)]
  }

  private async getTrendingCategories() {
    try {
      const categories = await prisma.product.groupBy({
        by: ['categories'],
        _count: {
          categories: true,
        },
        where: {
          status: 'APPROVED',
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: {
          _count: {
            categories: 'desc',
          },
        },
        take: 10,
      })

      return categories.map((cat) => ({
        name: cat.categories[0] || 'Unknown',
        count: cat._count.categories,
      }))
    } catch (error) {
      console.error('Error getting trending categories:', error)
      return []
    }
  }

  private async getContentTemplate(
    templateId: string
  ): Promise<ContentTemplate | null> {
    // Simplified - would fetch from database
    return null
  }

  private generateSEOTitle(title: string, categories: string[]): string {
    const category = categories[0] || 'Gifts'
    return `${title} | Best ${category} Guide 2024`
  }

  private generateSEODescription(description: string): string {
    if (description.length <= 160) return description

    return description.substring(0, 157) + '...'
  }

  private generateMetaKeywords(tags: string[], categories: string[]): string[] {
    const keywords = [...tags, ...categories]
    const additionalKeywords = [
      'gifts',
      'recommendations',
      'guide',
      '2024',
      'best',
    ]

    return [...new Set([...keywords, ...additionalKeywords])].slice(0, 10)
  }

  private generatePerformanceRecommendations(
    performance: any,
    content: any
  ): string[] {
    const recommendations = []

    if (performance.views < 100) {
      recommendations.push('Consider promoting this content on social media')
    }

    if (performance.avgTimeOnPage < 30) {
      recommendations.push('Content may be too short or not engaging enough')
    }

    if (performance.shares < 5) {
      recommendations.push(
        'Add more shareable elements like quotes or statistics'
      )
    }

    if (performance.comments < 2) {
      recommendations.push(
        'Include questions or calls-to-action to encourage engagement'
      )
    }

    return recommendations
  }

  // Content maintenance
  async cleanupOldContent(daysOld: number = 365) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

      const oldContent = await prisma.content.findMany({
        where: {
          status: 'ARCHIVED',
          updatedAt: { lt: cutoffDate },
        },
      })

      for (const content of oldContent) {
        await this.contentManager.deleteContent(content.id)
      }

      console.log(`🧹 Cleaned up ${oldContent.length} old content pieces`)
      return { cleaned: oldContent.length }
    } catch (error) {
      console.error('Error cleaning up old content:', error)
      throw error
    }
  }

  async updateContentMetadata() {
    try {
      const content = await prisma.content.findMany({
        where: {
          status: 'PUBLISHED',
          seoTitle: null,
        },
      })

      for (const item of content) {
        await this.optimizeContentForSEO(item.id)
      }

      console.log(`📊 Updated metadata for ${content.length} content pieces`)
      return { updated: content.length }
    } catch (error) {
      console.error('Error updating content metadata:', error)
      throw error
    }
  }
}

export {
  ContentAutomation,
  AutomationConfig,
  ContentTemplate,
  ScheduledContent,
}

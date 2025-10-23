#!/usr/bin/env tsx

import { ContentAutomation } from '@/src/features/cms/content-automation'
import { GiftGuideManager } from '@/src/features/cms/gift-guide-manager'
import { ContentManager } from '@/src/features/cms/content-manager'

// CMS Automation Script
class CMSAutomationScript {
  private contentAutomation: ContentAutomation
  private giftGuideManager: GiftGuideManager
  private contentManager: ContentManager

  constructor() {
    this.contentAutomation = new ContentAutomation()
    this.giftGuideManager = new GiftGuideManager()
    this.contentManager = new ContentManager()
  }

  // Main automation tasks
  async runAutomationTasks() {
    console.log('🚀 Starting CMS automation tasks...')

    try {
      // 1. Process scheduled content
      await this.processScheduledContent()

      // 2. Generate seasonal content
      await this.generateSeasonalContent()

      // 3. Generate trending content
      await this.generateTrendingContent()

      // 4. Update content metadata
      await this.updateContentMetadata()

      // 5. Cleanup old content
      await this.cleanupOldContent()

      console.log('✅ CMS automation tasks completed successfully')
    } catch (error) {
      console.error('❌ CMS automation failed:', error)
      throw error
    }
  }

  // Process scheduled content
  private async processScheduledContent() {
    console.log('⏰ Processing scheduled content...')

    try {
      const result = await this.contentAutomation.processScheduledContent()
      console.log(`✅ Processed ${result.published} scheduled content pieces`)
    } catch (error) {
      console.error('Error processing scheduled content:', error)
    }
  }

  // Generate seasonal content
  private async generateSeasonalContent() {
    console.log('🎄 Generating seasonal content...')

    try {
      const content = await this.contentAutomation.generateSeasonalContent()
      console.log(`✅ Generated ${content.length} seasonal content pieces`)
    } catch (error) {
      console.error('Error generating seasonal content:', error)
    }
  }

  // Generate trending content
  private async generateTrendingContent() {
    console.log('📈 Generating trending content...')

    try {
      const content = await this.contentAutomation.generateTrendingContent()
      console.log(`✅ Generated ${content.length} trending content pieces`)
    } catch (error) {
      console.error('Error generating trending content:', error)
    }
  }

  // Update content metadata
  private async updateContentMetadata() {
    console.log('📊 Updating content metadata...')

    try {
      const result = await this.contentAutomation.updateContentMetadata()
      console.log(`✅ Updated metadata for ${result.updated} content pieces`)
    } catch (error) {
      console.error('Error updating content metadata:', error)
    }
  }

  // Cleanup old content
  private async cleanupOldContent() {
    console.log('🧹 Cleaning up old content...')

    try {
      const result = await this.contentAutomation.cleanupOldContent(365) // 1 year
      console.log(`✅ Cleaned up ${result.cleaned} old content pieces`)
    } catch (error) {
      console.error('Error cleaning up old content:', error)
    }
  }

  // Generate gift guides
  async generateGiftGuides() {
    console.log('🎁 Generating gift guides...')

    try {
      const categories = [
        'Electronics',
        'Home & Garden',
        'Books',
        'Sports',
        'Beauty',
        'Fashion',
        'Toys',
        'Kitchen',
        'Outdoor',
        'Health',
      ]

      const occasions = [
        'Birthday',
        'Christmas',
        "Valentine's Day",
        'Anniversary',
        'Graduation',
        'Wedding',
        'Baby Shower',
        'Housewarming',
      ]

      const budgets = ['under-50', '50-100', '100-200', '200-500', 'over-500']

      const guides = []

      // Generate guides for each category
      for (const category of categories.slice(0, 5)) {
        const guide = await this.giftGuideManager.generateGiftGuide(category)
        guides.push(guide)
      }

      // Generate seasonal guides
      for (const occasion of occasions.slice(0, 3)) {
        const guide = await this.giftGuideManager.generateGiftGuide(
          'Gifts',
          occasion
        )
        guides.push(guide)
      }

      // Generate budget guides
      for (const budget of budgets.slice(0, 3)) {
        const guide = await this.giftGuideManager.generateGiftGuide(
          'Gifts',
          undefined,
          budget
        )
        guides.push(guide)
      }

      console.log(`✅ Generated ${guides.length} gift guides`)
      return guides
    } catch (error) {
      console.error('Error generating gift guides:', error)
      throw error
    }
  }

  // Generate blog posts
  async generateBlogPosts() {
    console.log('📝 Generating blog posts...')

    try {
      const topics = [
        'Gift Ideas',
        'Holiday Shopping',
        'Personalized Gifts',
        'Tech Gifts',
        'Home Decor',
        'Fashion Accessories',
        'Beauty Products',
        'Sports Equipment',
      ]

      const categories = [
        'Gift Guides',
        'Shopping Tips',
        'Product Reviews',
        'Seasonal',
        'Tech',
        'Fashion',
        'Home',
        'Beauty',
      ]

      const posts = []

      for (let i = 0; i < Math.min(topics.length, categories.length); i++) {
        const post = await this.contentAutomation.generateBlogPost(
          topics[i],
          categories[i]
        )
        posts.push(post)
      }

      console.log(`✅ Generated ${posts.length} blog posts`)
      return posts
    } catch (error) {
      console.error('Error generating blog posts:', error)
      throw error
    }
  }

  // Content analytics
  async generateContentAnalytics() {
    console.log('📊 Generating content analytics...')

    try {
      const content = await this.contentManager.listContent({
        status: 'PUBLISHED',
        published: true,
        limit: 100,
      })

      const analytics = []

      for (const item of content) {
        const itemAnalytics =
          await this.contentAutomation.analyzeContentPerformance(item.id)
        analytics.push({
          id: item.id,
          title: item.title,
          ...itemAnalytics,
        })
      }

      console.log(
        `✅ Generated analytics for ${analytics.length} content pieces`
      )
      return analytics
    } catch (error) {
      console.error('Error generating content analytics:', error)
      throw error
    }
  }

  // Content optimization
  async optimizeContent() {
    console.log('🔍 Optimizing content...')

    try {
      const content = await this.contentManager.listContent({
        status: 'PUBLISHED',
        published: true,
        limit: 50,
      })

      const optimized = []

      for (const item of content) {
        if (!item.seoTitle || !item.seoDescription) {
          const seoData = await this.contentAutomation.optimizeContentForSEO(
            item.id
          )
          optimized.push({
            id: item.id,
            title: item.title,
            ...seoData,
          })
        }
      }

      console.log(`✅ Optimized ${optimized.length} content pieces`)
      return optimized
    } catch (error) {
      console.error('Error optimizing content:', error)
      throw error
    }
  }

  // Generate content report
  async generateContentReport() {
    console.log('📋 Generating content report...')

    try {
      const [content, guides, analytics] = await Promise.all([
        this.contentManager.listContent({ limit: 1000 }),
        this.giftGuideManager.listGiftGuides({ limit: 1000 }),
        this.generateContentAnalytics(),
      ])

      const report = {
        summary: {
          totalContent: content.length,
          totalGuides: guides.length,
          publishedContent: content.filter((c) => c.status === 'PUBLISHED')
            .length,
          draftContent: content.filter((c) => c.status === 'DRAFT').length,
          scheduledContent: content.filter((c) => c.status === 'SCHEDULED')
            .length,
        },
        topPerforming: analytics
          .sort((a, b) => b.performance.views - a.performance.views)
          .slice(0, 10),
        categories: this.analyzeCategories(content),
        tags: this.analyzeTags(content),
        trends: this.analyzeTrends(analytics),
      }

      console.log('✅ Content report generated')
      return report
    } catch (error) {
      console.error('Error generating content report:', error)
      throw error
    }
  }

  // Analyze categories
  private analyzeCategories(content: any[]) {
    const categoryCount: Record<string, number> = {}

    content.forEach((item) => {
      item.categories.forEach((category: string) => {
        categoryCount[category] = (categoryCount[category] || 0) + 1
      })
    })

    return Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([category, count]) => ({ category, count }))
  }

  // Analyze tags
  private analyzeTags(content: any[]) {
    const tagCount: Record<string, number> = {}

    content.forEach((item) => {
      item.tags.forEach((tag: string) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    })

    return Object.entries(tagCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }))
  }

  // Analyze trends
  private analyzeTrends(analytics: any[]) {
    const totalViews = analytics.reduce(
      (sum, item) => sum + item.performance.views,
      0
    )
    const totalShares = analytics.reduce(
      (sum, item) => sum + item.performance.shares,
      0
    )
    const totalComments = analytics.reduce(
      (sum, item) => sum + item.performance.comments,
      0
    )
    const avgTimeOnPage =
      analytics.reduce((sum, item) => sum + item.performance.avgTimeOnPage, 0) /
      analytics.length

    return {
      totalViews,
      totalShares,
      totalComments,
      avgTimeOnPage,
      engagementRate: totalComments / totalViews,
      shareRate: totalShares / totalViews,
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'automation'

  const script = new CMSAutomationScript()

  try {
    switch (command) {
      case 'automation':
        await script.runAutomationTasks()
        break

      case 'gift-guides':
        await script.generateGiftGuides()
        break

      case 'blog-posts':
        await script.generateBlogPosts()
        break

      case 'analytics':
        await script.generateContentAnalytics()
        break

      case 'optimize':
        await script.optimizeContent()
        break

      case 'report':
        const report = await script.generateContentReport()
        console.log('\n📊 Content Report:')
        console.log(`Total Content: ${report.summary.totalContent}`)
        console.log(`Total Guides: ${report.summary.totalGuides}`)
        console.log(`Published: ${report.summary.publishedContent}`)
        console.log(`Drafts: ${report.summary.draftContent}`)
        console.log(`Scheduled: ${report.summary.scheduledContent}`)
        console.log('\nTop Categories:')
        report.categories.forEach((cat) => {
          console.log(`  ${cat.category}: ${cat.count}`)
        })
        console.log('\nTop Tags:')
        report.tags.slice(0, 10).forEach((tag) => {
          console.log(`  #${tag.tag}: ${tag.count}`)
        })
        break

      default:
        console.log(
          'Usage: tsx scripts/cms-automation.ts [automation|gift-guides|blog-posts|analytics|optimize|report]'
        )
        console.log('  automation    - Run all automation tasks')
        console.log('  gift-guides   - Generate gift guides')
        console.log('  blog-posts    - Generate blog posts')
        console.log('  analytics     - Generate content analytics')
        console.log('  optimize      - Optimize content for SEO')
        console.log('  report        - Generate content report')
        break
    }

    process.exit(0)
  } catch (error) {
    console.error('❌ CMS automation error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { CMSAutomationScript }

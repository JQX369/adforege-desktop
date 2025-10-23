#!/usr/bin/env tsx

import {
  getViewportInfo,
  getPerformanceRecommendations,
} from '@/lib/mobile-utils'

interface MobilePerformanceMetrics {
  viewport: ReturnType<typeof getViewportInfo>
  recommendations: string[]
  score: {
    overall: number
    performance: number
    accessibility: number
    bestPractices: number
    seo: number
  }
  metrics: {
    firstContentfulPaint: number
    largestContentfulPaint: number
    firstInputDelay: number
    cumulativeLayoutShift: number
    totalBlockingTime: number
  }
  issues: Array<{
    type: 'performance' | 'accessibility' | 'best-practices' | 'seo'
    severity: 'low' | 'medium' | 'high'
    message: string
    suggestion: string
  }>
}

class MobilePerformanceMonitor {
  private static instance: MobilePerformanceMonitor

  static getInstance(): MobilePerformanceMonitor {
    if (!MobilePerformanceMonitor.instance) {
      MobilePerformanceMonitor.instance = new MobilePerformanceMonitor()
    }
    return MobilePerformanceMonitor.instance
  }

  async analyzeMobilePerformance(): Promise<MobilePerformanceMetrics> {
    console.log('📱 Analyzing mobile performance...\n')

    const viewport = getViewportInfo()
    const recommendations = getPerformanceRecommendations()

    // Simulate performance metrics (in production, these would be real measurements)
    const metrics = {
      firstContentfulPaint: viewport.isMobile ? 1200 : 800,
      largestContentfulPaint: viewport.isMobile ? 2500 : 1800,
      firstInputDelay: viewport.isMobile ? 150 : 100,
      cumulativeLayoutShift: viewport.isMobile ? 0.15 : 0.08,
      totalBlockingTime: viewport.isMobile ? 300 : 200,
    }

    // Calculate performance score
    const score = this.calculatePerformanceScore(metrics, viewport)

    // Identify issues
    const issues = this.identifyPerformanceIssues(metrics, viewport)

    const result: MobilePerformanceMetrics = {
      viewport,
      recommendations,
      score,
      metrics,
      issues,
    }

    return result
  }

  private calculatePerformanceScore(
    metrics: MobilePerformanceMetrics['metrics'],
    viewport: ReturnType<typeof getViewportInfo>
  ): MobilePerformanceMetrics['score'] {
    // Performance score calculation
    const performanceScore = this.calculateMetricScore(
      'performance',
      metrics,
      viewport
    )
    const accessibilityScore = this.calculateMetricScore(
      'accessibility',
      metrics,
      viewport
    )
    const bestPracticesScore = this.calculateMetricScore(
      'best-practices',
      metrics,
      viewport
    )
    const seoScore = this.calculateMetricScore('seo', metrics, viewport)

    const overall = Math.round(
      (performanceScore + accessibilityScore + bestPracticesScore + seoScore) /
        4
    )

    return {
      overall,
      performance: performanceScore,
      accessibility: accessibilityScore,
      bestPractices: bestPracticesScore,
      seo: seoScore,
    }
  }

  private calculateMetricScore(
    type: 'performance' | 'accessibility' | 'best-practices' | 'seo',
    metrics: MobilePerformanceMetrics['metrics'],
    viewport: ReturnType<typeof getViewportInfo>
  ): number {
    switch (type) {
      case 'performance':
        return this.calculatePerformanceMetricScore(metrics, viewport)
      case 'accessibility':
        return this.calculateAccessibilityScore(viewport)
      case 'best-practices':
        return this.calculateBestPracticesScore(viewport)
      case 'seo':
        return this.calculateSEOScore(viewport)
      default:
        return 100
    }
  }

  private calculatePerformanceMetricScore(
    metrics: MobilePerformanceMetrics['metrics'],
    viewport: ReturnType<typeof getViewportInfo>
  ): number {
    let score = 100

    // FCP scoring
    if (metrics.firstContentfulPaint > 1800) score -= 20
    else if (metrics.firstContentfulPaint > 1200) score -= 10

    // LCP scoring
    if (metrics.largestContentfulPaint > 4000) score -= 25
    else if (metrics.largestContentfulPaint > 2500) score -= 15

    // FID scoring
    if (metrics.firstInputDelay > 300) score -= 20
    else if (metrics.firstInputDelay > 100) score -= 10

    // CLS scoring
    if (metrics.cumulativeLayoutShift > 0.25) score -= 20
    else if (metrics.cumulativeLayoutShift > 0.1) score -= 10

    // TBT scoring
    if (metrics.totalBlockingTime > 600) score -= 20
    else if (metrics.totalBlockingTime > 300) score -= 10

    // Mobile penalty
    if (viewport.isMobile) score -= 5

    return Math.max(0, score)
  }

  private calculateAccessibilityScore(
    viewport: ReturnType<typeof getViewportInfo>
  ): number {
    let score = 100

    // Touch target size
    if (viewport.isMobile) {
      score -= 5 // Mobile devices need larger touch targets
    }

    // High DPI displays
    if (viewport.devicePixelRatio > 2) {
      score -= 5 // Need to ensure text is readable on high DPI
    }

    return Math.max(0, score)
  }

  private calculateBestPracticesScore(
    viewport: ReturnType<typeof getViewportInfo>
  ): number {
    let score = 100

    // Mobile-specific best practices
    if (viewport.isMobile) {
      score -= 10 // Mobile has stricter requirements
    }

    // Touch support
    if (viewport.touchSupport) {
      score += 5 // Touch support is good
    }

    return Math.max(0, score)
  }

  private calculateSEOScore(
    viewport: ReturnType<typeof getViewportInfo>
  ): number {
    let score = 100

    // Mobile-first indexing
    if (viewport.isMobile) {
      score += 10 // Mobile-first is preferred by Google
    }

    // Responsive design
    if (viewport.isMobile || viewport.isTablet || viewport.isDesktop) {
      score += 5 // Responsive design is good for SEO
    }

    return Math.max(0, score)
  }

  private identifyPerformanceIssues(
    metrics: MobilePerformanceMetrics['metrics'],
    viewport: ReturnType<typeof getViewportInfo>
  ): MobilePerformanceMetrics['issues'] {
    const issues: MobilePerformanceMetrics['issues'] = []

    // FCP issues
    if (metrics.firstContentfulPaint > 1800) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: 'First Contentful Paint is too slow',
        suggestion:
          'Optimize critical rendering path and reduce server response time',
      })
    } else if (metrics.firstContentfulPaint > 1200) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'First Contentful Paint could be improved',
        suggestion: 'Consider code splitting and lazy loading',
      })
    }

    // LCP issues
    if (metrics.largestContentfulPaint > 4000) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: 'Largest Contentful Paint is too slow',
        suggestion: 'Optimize images and reduce render-blocking resources',
      })
    } else if (metrics.largestContentfulPaint > 2500) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'Largest Contentful Paint could be improved',
        suggestion: 'Use next-gen image formats and optimize loading',
      })
    }

    // FID issues
    if (metrics.firstInputDelay > 300) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: 'First Input Delay is too high',
        suggestion: 'Reduce JavaScript execution time and optimize main thread',
      })
    } else if (metrics.firstInputDelay > 100) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'First Input Delay could be improved',
        suggestion: 'Break up long tasks and use web workers',
      })
    }

    // CLS issues
    if (metrics.cumulativeLayoutShift > 0.25) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: 'Cumulative Layout Shift is too high',
        suggestion:
          'Reserve space for images and avoid dynamically injected content',
      })
    } else if (metrics.cumulativeLayoutShift > 0.1) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'Cumulative Layout Shift could be improved',
        suggestion: 'Set explicit dimensions for media and avoid layout shifts',
      })
    }

    // TBT issues
    if (metrics.totalBlockingTime > 600) {
      issues.push({
        type: 'performance',
        severity: 'high',
        message: 'Total Blocking Time is too high',
        suggestion: 'Reduce JavaScript bundle size and split code',
      })
    } else if (metrics.totalBlockingTime > 300) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'Total Blocking Time could be improved',
        suggestion: 'Optimize JavaScript execution and use code splitting',
      })
    }

    // Mobile-specific issues
    if (viewport.isMobile) {
      if (viewport.devicePixelRatio > 2) {
        issues.push({
          type: 'performance',
          severity: 'medium',
          message: 'High DPI display detected',
          suggestion:
            'Provide high-resolution images and optimize for retina displays',
        })
      }

      if (!viewport.touchSupport) {
        issues.push({
          type: 'accessibility',
          severity: 'low',
          message: 'Touch support not detected',
          suggestion: 'Ensure touch-friendly interactions and target sizes',
        })
      }
    }

    return issues
  }

  async printReport(metrics: MobilePerformanceMetrics): Promise<void> {
    console.log('📱 Mobile Performance Report')
    console.log('='.repeat(50))

    // Viewport information
    console.log('\n📱 Viewport Information:')
    console.log(
      `  Device Type: ${metrics.viewport.isMobile ? 'Mobile' : metrics.viewport.isTablet ? 'Tablet' : 'Desktop'}`
    )
    console.log(
      `  Screen Size: ${metrics.viewport.width}x${metrics.viewport.height}`
    )
    console.log(`  Device Pixel Ratio: ${metrics.viewport.devicePixelRatio}`)
    console.log(`  Orientation: ${metrics.viewport.orientation}`)
    console.log(
      `  Touch Support: ${metrics.viewport.touchSupport ? 'Yes' : 'No'}`
    )

    // Performance scores
    console.log('\n📊 Performance Scores:')
    console.log(`  Overall Score: ${metrics.score.overall}/100`)
    console.log(`  Performance: ${metrics.score.performance}/100`)
    console.log(`  Accessibility: ${metrics.score.accessibility}/100`)
    console.log(`  Best Practices: ${metrics.score.bestPractices}/100`)
    console.log(`  SEO: ${metrics.score.seo}/100`)

    // Core Web Vitals
    console.log('\n⚡ Core Web Vitals:')
    console.log(
      `  First Contentful Paint: ${metrics.metrics.firstContentfulPaint}ms`
    )
    console.log(
      `  Largest Contentful Paint: ${metrics.metrics.largestContentfulPaint}ms`
    )
    console.log(`  First Input Delay: ${metrics.metrics.firstInputDelay}ms`)
    console.log(
      `  Cumulative Layout Shift: ${metrics.metrics.cumulativeLayoutShift}`
    )
    console.log(`  Total Blocking Time: ${metrics.metrics.totalBlockingTime}ms`)

    // Issues
    if (metrics.issues.length > 0) {
      console.log('\n⚠️  Performance Issues:')
      metrics.issues.forEach((issue, index) => {
        console.log(
          `  ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`
        )
        console.log(`     Suggestion: ${issue.suggestion}`)
      })
    } else {
      console.log('\n✅ No performance issues detected')
    }

    // Recommendations
    console.log('\n💡 Recommendations:')
    metrics.recommendations.forEach((recommendation, index) => {
      console.log(`  ${index + 1}. ${recommendation}`)
    })

    console.log('\n' + '='.repeat(50))
  }
}

// Run the monitoring
async function main() {
  const monitor = MobilePerformanceMonitor.getInstance()

  try {
    const metrics = await monitor.analyzeMobilePerformance()
    await monitor.printReport(metrics)
  } catch (error) {
    console.error('Mobile performance monitoring failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { MobilePerformanceMonitor }

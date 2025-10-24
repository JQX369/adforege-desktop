'use client'

import { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/ui/card'
import { Button } from '@/src/ui/button'
import { Badge } from '@/src/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/ui/tabs'
import { Progress } from '@/src/ui/progress'
import {
  Smartphone,
  Tablet,
  Monitor,
  Zap,
  Eye,
  Shield,
  Search,
  RefreshCw,
  Download,
  Upload,
  Wifi,
  Battery,
  Signal,
  Hand as TouchIcon,
} from 'lucide-react'

interface MobileMetrics {
  viewport: {
    width: number
    height: number
    devicePixelRatio: number
    orientation: string
    isMobile: boolean
    isTablet: boolean
    isDesktop: boolean
    touchSupport: boolean
  }
  performance: {
    firstContentfulPaint: number
    largestContentfulPaint: number
    firstInputDelay: number
    cumulativeLayoutShift: number
    totalBlockingTime: number
  }
  scores: {
    overall: number
    performance: number
    accessibility: number
    bestPractices: number
    seo: number
  }
  recommendations: string[]
  issues: Array<{
    type: string
    severity: string
    message: string
    suggestion: string
  }>
}

export default function MobileDashboard() {
  const [metrics, setMetrics] = useState<MobileMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMobileMetrics = async () => {
    setIsLoading(true)

    try {
      // Mock mobile metrics data
      const mockMetrics: MobileMetrics = {
        viewport: {
          width: 375,
          height: 667,
          devicePixelRatio: 2,
          orientation: 'portrait',
          isMobile: true,
          isTablet: false,
          isDesktop: false,
          touchSupport: true,
        },
        performance: {
          firstContentfulPaint: 1200,
          largestContentfulPaint: 2500,
          firstInputDelay: 150,
          cumulativeLayoutShift: 0.15,
          totalBlockingTime: 300,
        },
        scores: {
          overall: 85,
          performance: 80,
          accessibility: 90,
          bestPractices: 85,
          seo: 85,
        },
        recommendations: [
          'Use WebP/AVIF image formats',
          'Implement lazy loading for images',
          'Minimize JavaScript bundle size',
          'Use CSS transforms instead of layout changes',
          'Implement service worker for caching',
          'Optimize font loading',
          'Use touch-friendly target sizes',
          'Implement pull-to-refresh',
        ],
        issues: [
          {
            type: 'performance',
            severity: 'medium',
            message: 'First Contentful Paint could be improved',
            suggestion: 'Consider code splitting and lazy loading',
          },
          {
            type: 'performance',
            severity: 'medium',
            message: 'Largest Contentful Paint could be improved',
            suggestion: 'Use next-gen image formats and optimize loading',
          },
        ],
      }

      setMetrics(mockMetrics)
    } catch (error) {
      console.error('Failed to fetch mobile metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMobileMetrics()
  }, [])

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return 'default'
    if (score >= 70) return 'secondary'
    return 'destructive'
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load mobile metrics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Mobile Performance Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and optimize mobile performance, touch interactions, and
              responsive design
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={fetchMobileMetrics} disabled={isLoading}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="viewport">Viewport</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Device Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Device Type
                </CardTitle>
                {metrics.viewport.isMobile ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                ) : metrics.viewport.isTablet ? (
                  <Tablet className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.viewport.isMobile
                    ? 'Mobile'
                    : metrics.viewport.isTablet
                      ? 'Tablet'
                      : 'Desktop'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.viewport.width}x{metrics.viewport.height}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Touch Support
                </CardTitle>
                <TouchIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.viewport.touchSupport ? 'Yes' : 'No'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.viewport.devicePixelRatio}x DPI
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Overall Score
                </CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${getScoreColor(metrics.scores.overall)}`}
                >
                  {metrics.scores.overall}/100
                </div>
                <Progress value={metrics.scores.overall} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Issues</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.issues.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.issues.filter((i) => i.severity === 'high').length}{' '}
                  high priority
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Scores */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Scores</CardTitle>
              <CardDescription>
                Core Web Vitals and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Performance</span>
                    <Badge
                      variant={getScoreBadgeVariant(metrics.scores.performance)}
                    >
                      {metrics.scores.performance}/100
                    </Badge>
                  </div>
                  <Progress value={metrics.scores.performance} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Accessibility</span>
                    <Badge
                      variant={getScoreBadgeVariant(
                        metrics.scores.accessibility
                      )}
                    >
                      {metrics.scores.accessibility}/100
                    </Badge>
                  </div>
                  <Progress value={metrics.scores.accessibility} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Best Practices</span>
                    <Badge
                      variant={getScoreBadgeVariant(
                        metrics.scores.bestPractices
                      )}
                    >
                      {metrics.scores.bestPractices}/100
                    </Badge>
                  </div>
                  <Progress value={metrics.scores.bestPractices} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">SEO</span>
                    <Badge variant={getScoreBadgeVariant(metrics.scores.seo)}>
                      {metrics.scores.seo}/100
                    </Badge>
                  </div>
                  <Progress value={metrics.scores.seo} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Web Vitals</CardTitle>
              <CardDescription>
                Key performance metrics for mobile devices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        First Contentful Paint
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.performance.firstContentfulPaint}ms
                      </span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        100 - metrics.performance.firstContentfulPaint / 30
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Target: &lt; 1.8s
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Largest Contentful Paint
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.performance.largestContentfulPaint}ms
                      </span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        100 - metrics.performance.largestContentfulPaint / 40
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Target: &lt; 2.5s
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        First Input Delay
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.performance.firstInputDelay}ms
                      </span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        100 - metrics.performance.firstInputDelay / 3
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Target: &lt; 100ms
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Cumulative Layout Shift
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {metrics.performance.cumulativeLayoutShift}
                      </span>
                    </div>
                    <Progress
                      value={Math.max(
                        0,
                        100 - metrics.performance.cumulativeLayoutShift * 400
                      )}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      Target: &lt; 0.1
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="viewport" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Viewport Information</CardTitle>
              <CardDescription>
                Device and screen characteristics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Screen Size</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.viewport.width} × {metrics.viewport.height}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Device Pixel Ratio
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.viewport.devicePixelRatio}x
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Orientation</span>
                    <span className="text-sm text-muted-foreground capitalize">
                      {metrics.viewport.orientation}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Touch Support</span>
                    <Badge
                      variant={
                        metrics.viewport.touchSupport ? 'default' : 'secondary'
                      }
                    >
                      {metrics.viewport.touchSupport
                        ? 'Supported'
                        : 'Not Supported'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Device Type</span>
                    <Badge variant="outline">
                      {metrics.viewport.isMobile
                        ? 'Mobile'
                        : metrics.viewport.isTablet
                          ? 'Tablet'
                          : 'Desktop'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Breakpoint</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.viewport.isMobile
                        ? 'Mobile'
                        : metrics.viewport.isTablet
                          ? 'Tablet'
                          : 'Desktop'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Safe Area</span>
                    <span className="text-sm text-muted-foreground">
                      Supported
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">High DPI</span>
                    <Badge
                      variant={
                        metrics.viewport.devicePixelRatio > 2
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {metrics.viewport.devicePixelRatio > 2
                        ? 'Retina'
                        : 'Standard'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>
                  Best practices for mobile performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {recommendation}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Issues */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Issues</CardTitle>
                <CardDescription>Issues that need attention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.issues.length > 0 ? (
                    metrics.issues.map((issue, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              issue.severity === 'high'
                                ? 'destructive'
                                : issue.severity === 'medium'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {issue.severity}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {issue.type}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{issue.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {issue.suggestion}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="h-12 w-12 text-green-500 mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">
                        No issues detected
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

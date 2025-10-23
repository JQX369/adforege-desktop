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
import { PerformanceMonitor } from '@/src/shared/utils/analytics'

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<
    Record<string, { average: number; count: number }>
  >({})
  const [webVitals, setWebVitals] = useState<Record<string, number>>({})

  useEffect(() => {
    const monitor = PerformanceMonitor.getInstance()

    const updateMetrics = () => {
      setMetrics(monitor.getSummary())
    }

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000)
    updateMetrics()

    // Track Core Web Vitals
    const trackWebVitals = () => {
      if (typeof window !== 'undefined' && 'performance' in window) {
        const navigation = performance.getEntriesByType(
          'navigation'
        )[0] as PerformanceNavigationTiming

        if (navigation) {
          setWebVitals({
            'Page Load Time': Math.round(
              navigation.loadEventEnd - navigation.fetchStart
            ),
            'DOM Content Loaded': Math.round(
              navigation.domContentLoadedEventEnd - navigation.fetchStart
            ),
            'First Byte': Math.round(
              navigation.responseStart - navigation.fetchStart
            ),
            'DNS Lookup': Math.round(
              navigation.domainLookupEnd - navigation.domainLookupStart
            ),
            'TCP Connect': Math.round(
              navigation.connectEnd - navigation.connectStart
            ),
          })
        }
      }
    }

    trackWebVitals()

    return () => clearInterval(interval)
  }, [])

  const clearMetrics = () => {
    const monitor = PerformanceMonitor.getInstance()
    monitor.clear()
    setMetrics({})
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Performance Dashboard</h1>
        <p className="text-muted-foreground">
          Real-time performance metrics and Core Web Vitals monitoring
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Core Web Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Core Web Vitals</CardTitle>
            <CardDescription>Current page performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(webVitals).map(([name, value]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{name}</span>
                  <span className="text-sm font-medium">
                    {value}ms
                    {name === 'Page Load Time' && (
                      <span
                        className={`ml-2 text-xs ${
                          value < 2000
                            ? 'text-green-600'
                            : value < 4000
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {value < 2000
                          ? 'Good'
                          : value < 4000
                            ? 'Needs Improvement'
                            : 'Poor'}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Custom Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Metrics</CardTitle>
            <CardDescription>
              Application-specific performance data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(metrics).map(([name, data]) => (
                <div key={name} className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{name}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {typeof data.average === 'number'
                        ? `${Math.round(data.average)}${name.includes('duration') ? 'ms' : ''}`
                        : data.average}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.count} samples
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>Performance monitoring controls</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                onClick={clearMetrics}
                variant="outline"
                className="w-full"
              >
                Clear Metrics
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Optimization Tips</CardTitle>
          <CardDescription>
            Best practices for improving Core Web Vitals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">
                Largest Contentful Paint (LCP)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Optimize images with WebP/AVIF formats</li>
                <li>• Use responsive images with proper sizing</li>
                <li>• Minimize render-blocking resources</li>
                <li>• Use CDN for static assets</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">First Input Delay (FID)</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Minimize JavaScript execution time</li>
                <li>• Use code splitting and lazy loading</li>
                <li>• Optimize third-party scripts</li>
                <li>• Use web workers for heavy computations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">
                Cumulative Layout Shift (CLS)
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Reserve space for images and ads</li>
                <li>• Avoid inserting content above existing content</li>
                <li>• Use font-display: swap for web fonts</li>
                <li>• Preload critical resources</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">General Optimization</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable compression (gzip/brotli)</li>
                <li>• Use HTTP/2 or HTTP/3</li>
                <li>• Implement proper caching strategies</li>
                <li>• Monitor and optimize database queries</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

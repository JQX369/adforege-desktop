import { NextWebVitalsMetric } from 'next/app'

// Core Web Vitals thresholds
const WEB_VITALS_THRESHOLDS = {
  LCP: 2500, // Largest Contentful Paint
  FID: 100, // First Input Delay
  CLS: 0.1, // Cumulative Layout Shift
  FCP: 1800, // First Contentful Paint
  TTFB: 800, // Time to First Byte,
} as const

// Track Core Web Vitals
export function reportWebVitals(metric: NextWebVitalsMetric) {
  const env = String(process.env.NODE_ENV || 'development')
  if (env !== 'production') return

  const { name, value, id } = metric

  if (typeof window !== 'undefined' && (window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('event', name, {
      value: Math.round(
        name === 'CLS' ? (value as number) * 1000 : (value as number)
      ),
      event_label: id,
      non_interaction: true,
      custom_map: { metric_rating: getMetricRating(name, value as number) },
    })
  }
}

function getMetricRating(name: string, value: number): string {
  const threshold =
    WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS]
  if (!threshold) return 'unknown'
  if (value <= threshold * 0.75) return 'good'
  if (value <= threshold) return 'needs-improvement'
  return 'poor'
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  trackMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) this.metrics.set(name, [])
    this.metrics.get(name)!.push(value)
  }

  getAverage(name: string): number {
    const values = this.metrics.get(name)
    if (!values || values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  getSummary(): Record<string, { average: number; count: number }> {
    const summary: Record<string, { average: number; count: number }> = {}
    for (const [name, values] of this.metrics.entries()) {
      summary[name] = { average: this.getAverage(name), count: values.length }
    }
    return summary
  }

  clear(): void {
    this.metrics.clear()
  }
}

export function trackPageLoad() {
  if (typeof window === 'undefined') return
  const monitor = PerformanceMonitor.getInstance()
  window.addEventListener('load', () => {
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    if (navigation) {
      monitor.trackMetric(
        'page_load_time',
        navigation.loadEventEnd - navigation.fetchStart
      )
      monitor.trackMetric(
        'dom_content_loaded',
        navigation.domContentLoadedEventEnd - navigation.fetchStart
      )
      monitor.trackMetric(
        'first_byte',
        navigation.responseStart - navigation.fetchStart
      )
    }
  })
}

export function trackApiCall(
  endpoint: string,
  duration: number,
  status: number
) {
  const monitor = PerformanceMonitor.getInstance()
  monitor.trackMetric(`api_${endpoint}_duration`, duration)
  monitor.trackMetric(`api_${endpoint}_status_${status}`, 1)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('event', 'api_call', {
      endpoint,
      duration: Math.round(duration),
      status,
      custom_map: {
        performance_rating:
          duration < 500
            ? 'good'
            : duration < 1000
              ? 'needs-improvement'
              : 'poor',
      },
    })
  }
}

export function trackInteraction(
  action: string,
  element?: string,
  value?: number
) {
  if (typeof window === 'undefined') return
  const monitor = PerformanceMonitor.getInstance()
  monitor.trackMetric(`interaction_${action}`, value || 1)
  if ((window as any).gtag) {
    const gtag = (window as any).gtag
    gtag('event', 'user_interaction', { action, element, value })
  }
}

export function initPerformanceMonitoring() {
  if (typeof window === 'undefined') return
  trackPageLoad()
  // Dynamic import with types from web-vitals
  import('web-vitals')
    .then((mod) => {
      const { getCLS, getFID, getFCP, getLCP, getTTFB } = mod as any
      if (getCLS) getCLS(reportWebVitals)
      if (getFID) getFID(reportWebVitals)
      if (getFCP) getFCP(reportWebVitals)
      if (getLCP) getLCP(reportWebVitals)
      if (getTTFB) getTTFB(reportWebVitals)
    })
    .catch(() => {})
}

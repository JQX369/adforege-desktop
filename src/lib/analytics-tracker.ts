// Analytics tracking system for user behavior, conversions, and A/B testing

export interface AnalyticsEvent {
  event: string
  properties?: Record<string, any>
  userId?: string
  sessionId?: string
  timestamp?: Date
  page?: string
  referrer?: string
  userAgent?: string
  ip?: string
}

export interface ConversionEvent extends AnalyticsEvent {
  event: 'conversion'
  conversionType:
    | 'signup'
    | 'purchase'
    | 'engagement'
    | 'recommendation'
    | 'click'
  value?: number
  currency?: string
  productId?: string
  category?: string
}

export interface UserBehaviorEvent extends AnalyticsEvent {
  event:
    | 'page_view'
    | 'click'
    | 'scroll'
    | 'hover'
    | 'form_submit'
    | 'search'
    | 'filter'
  element?: string
  elementType?: string
  elementId?: string
  elementClass?: string
  elementText?: string
  position?: { x: number; y: number }
  duration?: number
  scrollDepth?: number
  formData?: Record<string, any>
  searchQuery?: string
  filterCriteria?: Record<string, any>
}

export interface ABTestEvent extends AnalyticsEvent {
  event: 'ab_test'
  testId: string
  variant: string
  action: 'view' | 'click' | 'convert'
  conversionValue?: number
}

export interface PerformanceEvent extends AnalyticsEvent {
  event: 'performance'
  metric:
    | 'page_load'
    | 'api_response'
    | 'image_load'
    | 'bundle_size'
    | 'core_web_vitals'
  value: number
  unit: 'ms' | 'bytes' | 'score'
  url?: string
  method?: string
  statusCode?: number
  resourceType?: string
}

class AnalyticsTracker {
  private static instance: AnalyticsTracker
  private events: AnalyticsEvent[] = []
  private sessionId: string
  private userId?: string
  private isEnabled: boolean
  private batchSize: number = 10
  private flushInterval: number = 30000 // 30 seconds
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.sessionId = this.generateSessionId()
    this.isEnabled =
      process.env.NODE_ENV === 'production' ||
      process.env.ANALYTICS_ENABLED === 'true'

    if (this.isEnabled) {
      this.startFlushTimer()
    }
  }

  static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker()
    }
    return AnalyticsTracker.instance
  }

  // Set user ID for tracking
  setUserId(userId: string): void {
    this.userId = userId
  }

  // Track a generic event
  track(event: string, properties?: Record<string, any>): void {
    if (!this.isEnabled) return

    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: new Date(),
      page:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.events.push(analyticsEvent)
    this.checkFlush()
  }

  // Track conversion events
  trackConversion(
    conversionEvent: Omit<ConversionEvent, 'event' | 'sessionId' | 'timestamp'>
  ): void {
    if (!this.isEnabled) return

    const event: ConversionEvent = {
      ...conversionEvent,
      event: 'conversion',
      sessionId: this.sessionId,
      timestamp: new Date(),
      page:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.events.push(event)
    this.checkFlush()
  }

  // Track user behavior events
  trackBehavior(
    behaviorEvent: Omit<UserBehaviorEvent, 'sessionId' | 'timestamp'>
  ): void {
    if (!this.isEnabled) return

    const event: UserBehaviorEvent = {
      ...behaviorEvent,
      sessionId: this.sessionId,
      timestamp: new Date(),
      page:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.events.push(event)
    this.checkFlush()
  }

  // Track A/B test events
  trackABTest(testEvent: Omit<ABTestEvent, 'sessionId' | 'timestamp'>): void {
    if (!this.isEnabled) return

    const event: ABTestEvent = {
      ...testEvent,
      sessionId: this.sessionId,
      timestamp: new Date(),
      page:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.events.push(event)
    this.checkFlush()
  }

  // Track performance events
  trackPerformance(
    performanceEvent: Omit<PerformanceEvent, 'sessionId' | 'timestamp'>
  ): void {
    if (!this.isEnabled) return

    const event: PerformanceEvent = {
      ...performanceEvent,
      sessionId: this.sessionId,
      timestamp: new Date(),
      page:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent:
        typeof window !== 'undefined' ? navigator.userAgent : undefined,
    }

    this.events.push(event)
    this.checkFlush()
  }

  // Track page views
  trackPageView(page?: string, properties?: Record<string, any>): void {
    this.trackBehavior({
      event: 'page_view',
      page:
        page ||
        (typeof window !== 'undefined' ? window.location.pathname : undefined),
      properties,
    })
  }

  // Track clicks
  trackClick(element: string, properties?: Record<string, any>): void {
    this.trackBehavior({
      event: 'click',
      element,
      properties,
    })
  }

  // Track form submissions
  trackFormSubmit(formName: string, formData?: Record<string, any>): void {
    this.trackBehavior({
      event: 'form_submit',
      element: formName,
      formData,
    })
  }

  // Track searches
  trackSearch(query: string, results?: number): void {
    this.trackBehavior({
      event: 'search',
      searchQuery: query,
      properties: { results },
    })
  }

  // Track scroll depth
  trackScrollDepth(depth: number): void {
    this.trackBehavior({
      event: 'scroll',
      scrollDepth: depth,
    })
  }

  // Track hover events
  trackHover(element: string, duration: number): void {
    this.trackBehavior({
      event: 'hover',
      element,
      duration,
    })
  }

  // Track filter usage
  trackFilter(criteria: Record<string, any>): void {
    this.trackBehavior({
      event: 'filter',
      filterCriteria: criteria,
    })
  }

  // Track recommendation interactions
  trackRecommendationInteraction(
    action: 'view' | 'like' | 'dislike' | 'save' | 'click',
    productId: string,
    properties?: Record<string, any>
  ): void {
    this.trackBehavior({
      event: 'click',
      element: `recommendation_${action}`,
      elementId: productId,
      properties,
    })
  }

  // Track gift form progress
  trackGiftFormProgress(
    step: number,
    totalSteps: number,
    formData?: Record<string, any>
  ): void {
    this.trackBehavior({
      event: 'form_submit',
      element: 'gift_form_progress',
      properties: {
        step,
        totalSteps,
        progress: (step / totalSteps) * 100,
        formData,
      },
    })
  }

  // Track vendor interactions
  trackVendorInteraction(
    action: 'view' | 'signup' | 'login' | 'submit',
    properties?: Record<string, any>
  ): void {
    this.trackBehavior({
      event: 'click',
      element: `vendor_${action}`,
      properties,
    })
  }

  // Track affiliate clicks
  trackAffiliateClick(
    productId: string,
    retailer: string,
    value?: number
  ): void {
    this.trackConversion({
      conversionType: 'click',
      productId,
      value,
      properties: {
        retailer,
        type: 'affiliate',
      },
    })
  }

  // Check if should flush events
  private checkFlush(): void {
    if (this.events.length >= this.batchSize) {
      this.flush()
    }
  }

  // Flush events to analytics service
  private async flush(): Promise<void> {
    if (this.events.length === 0) return

    const eventsToFlush = [...this.events]
    this.events = []

    try {
      // Send to analytics service
      await this.sendToAnalyticsService(eventsToFlush)
    } catch (error) {
      console.error('Failed to send analytics events:', error)
      // Re-add events to queue for retry
      this.events.unshift(...eventsToFlush)
    }
  }

  // Send events to analytics service
  private async sendToAnalyticsService(
    events: AnalyticsEvent[]
  ): Promise<void> {
    // In production, this would send to your analytics service
    // For now, we'll send to a local API endpoint
    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      })

      if (!response.ok) {
        throw new Error(`Analytics API returned ${response.status}`)
      }
    } catch (error) {
      console.error('Analytics service error:', error)
      throw error
    }
  }

  // Start flush timer
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.flushInterval)
  }

  // Stop flush timer
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
  }

  // Generate session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Get analytics data
  getAnalyticsData(): {
    sessionId: string
    userId?: string
    eventCount: number
    isEnabled: boolean
  } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      eventCount: this.events.length,
      isEnabled: this.isEnabled,
    }
  }

  // Clear analytics data
  clearAnalyticsData(): void {
    this.events = []
    this.userId = undefined
    this.sessionId = this.generateSessionId()
  }

  // Enable/disable analytics
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      this.startFlushTimer()
    } else {
      this.stopFlushTimer()
    }
  }

  // Cleanup
  destroy(): void {
    this.stopFlushTimer()
    this.flush() // Flush remaining events
  }
}

// Global analytics tracker instance
export const analyticsTracker = AnalyticsTracker.getInstance()

// Utility functions
export function trackEvent(
  event: string,
  properties?: Record<string, any>
): void {
  analyticsTracker.track(event, properties)
}

export function trackConversion(
  conversionEvent: Omit<ConversionEvent, 'event' | 'sessionId' | 'timestamp'>
): void {
  analyticsTracker.trackConversion(conversionEvent)
}

export function trackBehavior(
  behaviorEvent: Omit<UserBehaviorEvent, 'sessionId' | 'timestamp'>
): void {
  analyticsTracker.trackBehavior(behaviorEvent)
}

export function trackABTest(
  testEvent: Omit<ABTestEvent, 'sessionId' | 'timestamp'>
): void {
  analyticsTracker.trackABTest(testEvent)
}

export function trackPerformance(
  performanceEvent: Omit<PerformanceEvent, 'sessionId' | 'timestamp'>
): void {
  analyticsTracker.trackPerformance(performanceEvent)
}

export function trackPageView(
  page?: string,
  properties?: Record<string, any>
): void {
  analyticsTracker.trackPageView(page, properties)
}

export function trackClick(
  element: string,
  properties?: Record<string, any>
): void {
  analyticsTracker.trackClick(element, properties)
}

export function trackFormSubmit(
  formName: string,
  formData?: Record<string, any>
): void {
  analyticsTracker.trackFormSubmit(formName, formData)
}

export function trackSearch(query: string, results?: number): void {
  analyticsTracker.trackSearch(query, results)
}

export function trackScrollDepth(depth: number): void {
  analyticsTracker.trackScrollDepth(depth)
}

export function trackHover(element: string, duration: number): void {
  analyticsTracker.trackHover(element, duration)
}

export function trackFilter(criteria: Record<string, any>): void {
  analyticsTracker.trackFilter(criteria)
}

export function trackRecommendationInteraction(
  action: 'view' | 'like' | 'dislike' | 'save' | 'click',
  productId: string,
  properties?: Record<string, any>
): void {
  analyticsTracker.trackRecommendationInteraction(action, productId, properties)
}

export function trackGiftFormProgress(
  step: number,
  totalSteps: number,
  formData?: Record<string, any>
): void {
  analyticsTracker.trackGiftFormProgress(step, totalSteps, formData)
}

export function trackVendorInteraction(
  action: 'view' | 'signup' | 'login' | 'submit',
  properties?: Record<string, any>
): void {
  analyticsTracker.trackVendorInteraction(action, properties)
}

export function trackAffiliateClick(
  productId: string,
  retailer: string,
  value?: number
): void {
  analyticsTracker.trackAffiliateClick(productId, retailer, value)
}

// React hook for analytics
export function useAnalytics() {
  return {
    track: trackEvent,
    trackConversion,
    trackBehavior,
    trackABTest,
    trackPerformance,
    trackPageView,
    trackClick,
    trackFormSubmit,
    trackSearch,
    trackScrollDepth,
    trackHover,
    trackFilter,
    trackRecommendationInteraction,
    trackGiftFormProgress,
    trackVendorInteraction,
    trackAffiliateClick,
    setUserId: analyticsTracker.setUserId.bind(analyticsTracker),
    getData: analyticsTracker.getAnalyticsData.bind(analyticsTracker),
  }
}

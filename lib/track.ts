// Lightweight analytics scaffold. Safe no-op so it can be imported without guarding.

type TrackEventPayload = Record<string, unknown> | undefined

export function trackEvent(eventName: string, payload?: TrackEventPayload) {
  if (typeof window === 'undefined') return
  try {
    // Replace with analytics SDK (GA4, PostHog, etc.) when ready.
    window.dispatchEvent(new CustomEvent('fairywize:analytics', { detail: { eventName, payload } }))
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('trackEvent noop failed', error)
    }
  }
}

export function trackPageView(page: string) {
  trackEvent('page_view', { page })
}


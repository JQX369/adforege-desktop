// Lightweight analytics scaffold. Safe no-op so it can be imported without guarding.

type TrackEventPayload = Record<string, unknown> | undefined

function pushToDataLayer(eventName: string, payload?: TrackEventPayload) {
  if (typeof window === 'undefined') return
  const win = window as typeof window & { dataLayer?: Array<Record<string, unknown>> }
  if (!Array.isArray(win.dataLayer)) return
  win.dataLayer.push({ event: eventName, ...(payload || {}) })
}

export function trackEvent(eventName: string, payload?: TrackEventPayload) {
  if (typeof window === 'undefined') return
  try {
    pushToDataLayer(eventName, payload)
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

export function registerAnalyticsDelegation() {
  if (typeof window === 'undefined') return
  const listener = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const analyticsEl = target.closest<HTMLElement>('[data-analytics]')
    if (!analyticsEl) return
    const name = analyticsEl.dataset.analytics
    if (!name) return
    trackEvent(name)
  }
  window.addEventListener('click', listener)
  return () => window.removeEventListener('click', listener)
}


import { describe, afterEach, beforeEach, it, expect, vi } from 'vitest'
import { trackEvent, registerAnalyticsDelegation } from '@/lib/track'

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>
  }
}

describe('trackEvent', () => {
  beforeEach(() => {
    window.dataLayer = []
    vi.spyOn(window, 'dispatchEvent')
  })

  afterEach(() => {
    window.dataLayer = undefined
    vi.restoreAllMocks()
  })

  it('pushes to dataLayer when available', () => {
    trackEvent('cta_primary_click', { source: 'hero' })
    expect(window.dataLayer).toContainEqual({
      event: 'cta_primary_click',
      source: 'hero',
    })
  })

  it('dispatches custom event for listeners', () => {
    trackEvent('cta_primary_click')
    expect(window.dispatchEvent).toHaveBeenCalled()
  })
})

describe('registerAnalyticsDelegation', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tracks clicks on elements with data-analytics attribute', () => {
    const cleanup = registerAnalyticsDelegation()
    window.dataLayer = []
    const button = document.createElement('button')
    button.dataset.analytics = 'cta_test'
    document.body.appendChild(button)

    button.click()

    expect(window.dataLayer).toContainEqual({ event: 'cta_test' })

    cleanup?.()
    document.body.removeChild(button)
  })
})

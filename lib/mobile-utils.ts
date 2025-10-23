// Mobile optimization utilities for responsive design and touch interactions

export interface CustomTouchEvent {
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel'
  touches: Touch[]
  targetTouches: Touch[]
  changedTouches: Touch[]
  preventDefault: () => void
  stopPropagation: () => void
}

export interface SwipeDirection {
  direction: 'left' | 'right' | 'up' | 'down' | 'none'
  distance: number
  velocity: number
  duration: number
}

export interface ViewportInfo {
  width: number
  height: number
  devicePixelRatio: number
  orientation: 'portrait' | 'landscape'
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  touchSupport: boolean
}

export interface BreakpointConfig {
  mobile: number
  tablet: number
  desktop: number
}

class MobileUtils {
  private static instance: MobileUtils
  private viewportInfo: ViewportInfo | null = null
  private breakpoints: BreakpointConfig = {
    mobile: 768,
    tablet: 1024,
    desktop: 1200,
  }
  private touchStartTime: number = 0
  private touchStartX: number = 0
  private touchStartY: number = 0
  private touchEndX: number = 0
  private touchEndY: number = 0

  constructor() {
    if (typeof window !== 'undefined') {
      this.updateViewportInfo()
      this.setupEventListeners()
    }
  }

  static getInstance(): MobileUtils {
    if (!MobileUtils.instance) {
      MobileUtils.instance = new MobileUtils()
    }
    return MobileUtils.instance
  }

  // Get current viewport information
  getViewportInfo(): ViewportInfo {
    if (!this.viewportInfo) {
      this.updateViewportInfo()
    }
    return this.viewportInfo!
  }

  // Update viewport information
  private updateViewportInfo(): void {
    if (typeof window === 'undefined') return

    const width = window.innerWidth
    const height = window.innerHeight
    const devicePixelRatio = window.devicePixelRatio || 1
    const orientation = width > height ? 'landscape' : 'portrait'

    this.viewportInfo = {
      width,
      height,
      devicePixelRatio,
      orientation,
      isMobile: width < this.breakpoints.mobile,
      isTablet:
        width >= this.breakpoints.mobile && width < this.breakpoints.tablet,
      isDesktop: width >= this.breakpoints.desktop,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    }
  }

  // Setup event listeners
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('resize', () => {
      this.updateViewportInfo()
    })

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.updateViewportInfo()
      }, 100)
    })
  }

  // Detect swipe gestures
  detectSwipe(
    element: HTMLElement,
    callback: (direction: SwipeDirection) => void,
    options: {
      threshold?: number
      velocityThreshold?: number
      preventDefault?: boolean
    } = {}
  ): () => void {
    const {
      threshold = 50,
      velocityThreshold = 0.3,
      preventDefault = true,
    } = options

    const handleTouchStart = (e: globalThis.TouchEvent) => {
      if (preventDefault) e.preventDefault()

      this.touchStartTime = Date.now()
      this.touchStartX = e.touches[0].clientX
      this.touchStartY = e.touches[0].clientY
    }

    const handleTouchEnd = (e: globalThis.TouchEvent) => {
      if (preventDefault) e.preventDefault()

      this.touchEndX = e.changedTouches[0].clientX
      this.touchEndY = e.changedTouches[0].clientY

      const deltaX = this.touchEndX - this.touchStartX
      const deltaY = this.touchEndY - this.touchStartY
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      const duration = Date.now() - this.touchStartTime
      const velocity = distance / duration

      if (distance < threshold || velocity < velocityThreshold) {
        callback({
          direction: 'none',
          distance: 0,
          velocity: 0,
          duration: 0,
        })
        return
      }

      let direction: SwipeDirection['direction'] = 'none'

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left'
      } else {
        direction = deltaY > 0 ? 'down' : 'up'
      }

      callback({
        direction,
        distance,
        velocity,
        duration,
      })
    }

    element.addEventListener('touchstart', handleTouchStart, {
      passive: !preventDefault,
    })
    element.addEventListener('touchend', handleTouchEnd, {
      passive: !preventDefault,
    })

    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }

  // Optimize images for mobile
  getOptimizedImageSrc(
    src: string,
    options: {
      width?: number
      height?: number
      quality?: number
      format?: 'webp' | 'avif' | 'jpeg' | 'png'
    } = {}
  ): string {
    const { width, height, quality = 80, format = 'webp' } = options
    const viewport = this.getViewportInfo()

    // Use device pixel ratio for high-DPI displays
    const actualWidth = width
      ? Math.ceil(width * viewport.devicePixelRatio)
      : undefined
    const actualHeight = height
      ? Math.ceil(height * viewport.devicePixelRatio)
      : undefined

    // For now, return the original src
    // In production, this would integrate with an image optimization service
    return src
  }

  // Get responsive breakpoint
  getCurrentBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
    const viewport = this.getViewportInfo()

    if (viewport.isMobile) return 'mobile'
    if (viewport.isTablet) return 'tablet'
    return 'desktop'
  }

  // Check if element is in viewport
  isInViewport(element: HTMLElement): boolean {
    if (typeof window === 'undefined') return false

    const rect = element.getBoundingClientRect()
    const viewport = this.getViewportInfo()

    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= viewport.height &&
      rect.right <= viewport.width
    )
  }

  // Get safe area insets for mobile devices
  getSafeAreaInsets(): {
    top: number
    right: number
    bottom: number
    left: number
  } {
    if (typeof window === 'undefined') {
      return { top: 0, right: 0, bottom: 0, left: 0 }
    }

    const computedStyle = getComputedStyle(document.documentElement)

    return {
      top: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0'
      ),
      right: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0'
      ),
      bottom: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0'
      ),
      left: parseInt(
        computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0'
      ),
    }
  }

  // Optimize font loading for mobile
  optimizeFontLoading(fontFamily: string): void {
    if (typeof window === 'undefined') return

    // Preload critical fonts
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = `/fonts/${fontFamily}.woff2`
    link.as = 'font'
    link.type = 'font/woff2'
    link.crossOrigin = 'anonymous'

    document.head.appendChild(link)
  }

  // Get mobile-specific CSS classes
  getMobileClasses(): {
    container: string
    text: string
    button: string
    input: string
    card: string
  } {
    const viewport = this.getViewportInfo()

    return {
      container: viewport.isMobile ? 'px-4' : 'px-6',
      text: viewport.isMobile ? 'text-sm' : 'text-base',
      button: viewport.isMobile ? 'h-10 px-4' : 'h-11 px-6',
      input: viewport.isMobile ? 'h-10 px-3' : 'h-11 px-4',
      card: viewport.isMobile ? 'p-4' : 'p-6',
    }
  }

  // Optimize animations for mobile
  shouldReduceMotion(): boolean {
    if (typeof window === 'undefined') return false

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // Get touch-friendly dimensions
  getTouchDimensions(): {
    minTouchTarget: number
    recommendedTouchTarget: number
    spacing: number
  } {
    const viewport = this.getViewportInfo()

    return {
      minTouchTarget: 44, // iOS HIG minimum
      recommendedTouchTarget: viewport.isMobile ? 48 : 44,
      spacing: viewport.isMobile ? 16 : 12,
    }
  }

  // Optimize lazy loading for mobile
  getLazyLoadingConfig(): {
    rootMargin: string
    threshold: number
  } {
    const viewport = this.getViewportInfo()

    return {
      rootMargin: viewport.isMobile ? '50px' : '100px',
      threshold: viewport.isMobile ? 0.1 : 0.2,
    }
  }

  // Get mobile performance recommendations
  getPerformanceRecommendations(): string[] {
    const viewport = this.getViewportInfo()
    const recommendations: string[] = []

    if (viewport.isMobile) {
      recommendations.push('Use WebP/AVIF image formats')
      recommendations.push('Implement lazy loading for images')
      recommendations.push('Minimize JavaScript bundle size')
      recommendations.push('Use CSS transforms instead of layout changes')
      recommendations.push('Implement service worker for caching')
      recommendations.push('Optimize font loading')
      recommendations.push('Use touch-friendly target sizes')
      recommendations.push('Implement pull-to-refresh')
    }

    if (viewport.devicePixelRatio > 2) {
      recommendations.push('Provide high-resolution images')
      recommendations.push('Optimize for retina displays')
    }

    if (viewport.touchSupport) {
      recommendations.push('Implement touch gestures')
      recommendations.push('Add haptic feedback')
      recommendations.push('Optimize for touch interactions')
    }

    return recommendations
  }
}

// Global mobile utils instance
export const mobileUtils = MobileUtils.getInstance()

// Utility functions
export function getViewportInfo(): ViewportInfo {
  return mobileUtils.getViewportInfo()
}

export function detectSwipe(
  element: HTMLElement,
  callback: (direction: SwipeDirection) => void,
  options?: Parameters<typeof mobileUtils.detectSwipe>[2]
): () => void {
  return mobileUtils.detectSwipe(element, callback, options)
}

export function getOptimizedImageSrc(
  src: string,
  options?: Parameters<typeof mobileUtils.getOptimizedImageSrc>[1]
): string {
  return mobileUtils.getOptimizedImageSrc(src, options)
}

export function getCurrentBreakpoint(): 'mobile' | 'tablet' | 'desktop' {
  return mobileUtils.getCurrentBreakpoint()
}

export function isInViewport(element: HTMLElement): boolean {
  return mobileUtils.isInViewport(element)
}

export function getSafeAreaInsets(): ReturnType<
  typeof mobileUtils.getSafeAreaInsets
> {
  return mobileUtils.getSafeAreaInsets()
}

export function optimizeFontLoading(fontFamily: string): void {
  return mobileUtils.optimizeFontLoading(fontFamily)
}

export function getMobileClasses(): ReturnType<
  typeof mobileUtils.getMobileClasses
> {
  return mobileUtils.getMobileClasses()
}

export function shouldReduceMotion(): boolean {
  return mobileUtils.shouldReduceMotion()
}

export function getTouchDimensions(): ReturnType<
  typeof mobileUtils.getTouchDimensions
> {
  return mobileUtils.getTouchDimensions()
}

export function getLazyLoadingConfig(): ReturnType<
  typeof mobileUtils.getLazyLoadingConfig
> {
  return mobileUtils.getLazyLoadingConfig()
}

export function getPerformanceRecommendations(): string[] {
  return mobileUtils.getPerformanceRecommendations()
}

// React hook for mobile utilities
export function useMobileUtils() {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo | null>(null)

  useEffect(() => {
    const updateViewport = () => {
      setViewportInfo(mobileUtils.getViewportInfo())
    }

    updateViewport()

    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  return {
    viewportInfo,
    isMobile: viewportInfo?.isMobile ?? false,
    isTablet: viewportInfo?.isTablet ?? false,
    isDesktop: viewportInfo?.isDesktop ?? false,
    touchSupport: viewportInfo?.touchSupport ?? false,
    getMobileClasses: mobileUtils.getMobileClasses.bind(mobileUtils),
    getTouchDimensions: mobileUtils.getTouchDimensions.bind(mobileUtils),
    getPerformanceRecommendations:
      mobileUtils.getPerformanceRecommendations.bind(mobileUtils),
  }
}

// Import React hooks
import { useState, useEffect } from 'react'

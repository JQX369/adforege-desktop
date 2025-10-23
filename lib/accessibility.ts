// Accessibility utilities for WCAG 2.1 AA compliance

export interface AccessibilityAudit {
  score: number
  issues: AccessibilityIssue[]
  recommendations: string[]
  compliance: {
    level: 'A' | 'AA' | 'AAA'
    percentage: number
  }
}

export interface AccessibilityIssue {
  id: string
  type: 'error' | 'warning' | 'info'
  severity: 'low' | 'medium' | 'high' | 'critical'
  category:
    | 'contrast'
    | 'keyboard'
    | 'screen-reader'
    | 'focus'
    | 'semantics'
    | 'aria'
  message: string
  element?: string
  selector?: string
  suggestion: string
  wcagCriteria: string[]
}

export interface ColorContrastResult {
  ratio: number
  level: 'AA' | 'AAA' | 'fail'
  foreground: string
  background: string
  isPassing: boolean
}

export interface FocusManagement {
  trapFocus: boolean
  restoreFocus: boolean
  focusVisible: boolean
  skipLinks: boolean
}

export interface ScreenReaderSupport {
  announcements: boolean
  liveRegions: boolean
  landmarks: boolean
  headings: boolean
}

class AccessibilityManager {
  private static instance: AccessibilityManager
  private issues: AccessibilityIssue[] = []
  private announcements: string[] = []

  constructor() {
    this.setupAccessibilityFeatures()
  }

  static getInstance(): AccessibilityManager {
    if (!AccessibilityManager.instance) {
      AccessibilityManager.instance = new AccessibilityManager()
    }
    return AccessibilityManager.instance
  }

  // Setup accessibility features
  private setupAccessibilityFeatures(): void {
    if (typeof window === 'undefined') return

    // Skip to main content link
    this.createSkipLink()

    // Focus management
    this.setupFocusManagement()

    // Screen reader announcements
    this.setupScreenReaderSupport()

    // Keyboard navigation
    this.setupKeyboardNavigation()

    // Reduced motion support
    this.setupReducedMotion()
  }

  // Create skip to main content link
  private createSkipLink(): void {
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.textContent = 'Skip to main content'
    skipLink.className =
      'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md'
    skipLink.setAttribute('aria-label', 'Skip to main content')

    document.body.insertBefore(skipLink, document.body.firstChild)
  }

  // Setup focus management
  private setupFocusManagement(): void {
    // Focus visible polyfill for older browsers
    if (!CSS.supports('selector(:focus-visible)')) {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          document.body.classList.add('keyboard-navigation')
        }
      })

      document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation')
      })
    }

    // Focus trap for modals
    this.setupFocusTrap()

    // Focus restoration
    this.setupFocusRestoration()
  }

  // Setup focus trap
  private setupFocusTrap(): void {
    const trapFocus = (element: HTMLElement) => {
      const focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus()
              e.preventDefault()
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus()
              e.preventDefault()
            }
          }
        }
      }

      element.addEventListener('keydown', handleTabKey)
      firstElement?.focus()

      return () => {
        element.removeEventListener('keydown', handleTabKey)
      }
    }

    // Make focus trap available globally
    ;(window as any).trapFocus = trapFocus
  }

  // Setup focus restoration
  private setupFocusRestoration(): void {
    let lastFocusedElement: HTMLElement | null = null

    document.addEventListener('focusin', (e) => {
      lastFocusedElement = e.target as HTMLElement
    })

    // Make focus restoration available globally
    ;(window as any).restoreFocus = () => {
      if (lastFocusedElement) {
        lastFocusedElement.focus()
      }
    }
  }

  // Setup screen reader support
  private setupScreenReaderSupport(): void {
    // Create live region for announcements
    const liveRegion = document.createElement('div')
    liveRegion.id = 'live-region'
    liveRegion.setAttribute('aria-live', 'polite')
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    document.body.appendChild(liveRegion)

    // Make announcements available globally
    ;(window as any).announceToScreenReader = (message: string) => {
      liveRegion.textContent = message
      setTimeout(() => {
        liveRegion.textContent = ''
      }, 1000)
    }
  }

  // Setup keyboard navigation
  private setupKeyboardNavigation(): void {
    // Escape key handling
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close modals, dropdowns, etc.
        const modals = document.querySelectorAll('[role="dialog"]')
        modals.forEach((modal) => {
          const closeButton = modal.querySelector('[aria-label="Close"]')
          if (closeButton) {
            ;(closeButton as HTMLElement).click()
          }
        })
      }
    })

    // Arrow key navigation for custom components
    this.setupArrowKeyNavigation()
  }

  // Setup arrow key navigation
  private setupArrowKeyNavigation(): void {
    const handleArrowKeys = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const role = target.getAttribute('role')

      if (role === 'menuitem' || role === 'option' || role === 'tab') {
        const container = target.closest(
          '[role="menu"], [role="listbox"], [role="tablist"]'
        )
        if (!container) return

        const items = Array.from(
          container.querySelectorAll(`[role="${role}"]`)
        ) as HTMLElement[]
        const currentIndex = items.indexOf(target)

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault()
          const nextIndex = (currentIndex + 1) % items.length
          items[nextIndex].focus()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault()
          const prevIndex =
            currentIndex === 0 ? items.length - 1 : currentIndex - 1
          items[prevIndex].focus()
        }
      }
    }

    document.addEventListener('keydown', handleArrowKeys)
  }

  // Setup reduced motion support
  private setupReducedMotion(): void {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    )

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.style.setProperty(
          '--animation-duration',
          '0.01ms'
        )
        document.documentElement.style.setProperty(
          '--transition-duration',
          '0.01ms'
        )
      } else {
        document.documentElement.style.removeProperty('--animation-duration')
        document.documentElement.style.removeProperty('--transition-duration')
      }
    }

    prefersReducedMotion.addEventListener('change', handleMotionChange)
    handleMotionChange(prefersReducedMotion)
  }

  // Check color contrast
  checkColorContrast(
    foreground: string,
    background: string
  ): ColorContrastResult {
    const fgColor = this.parseColor(foreground)
    const bgColor = this.parseColor(background)

    if (!fgColor || !bgColor) {
      return {
        ratio: 0,
        level: 'fail',
        foreground,
        background,
        isPassing: false,
      }
    }

    const ratio = this.calculateContrastRatio(fgColor, bgColor)

    let level: 'AA' | 'AAA' | 'fail'
    if (ratio >= 7) {
      level = 'AAA'
    } else if (ratio >= 4.5) {
      level = 'AA'
    } else {
      level = 'fail'
    }

    return {
      ratio,
      level,
      foreground,
      background,
      isPassing: ratio >= 4.5,
    }
  }

  // Parse color string to RGB
  private parseColor(
    color: string
  ): { r: number; g: number; b: number } | null {
    // Remove # if present
    color = color.replace('#', '')

    // Convert hex to RGB
    if (color.length === 3) {
      color = color
        .split('')
        .map((c) => c + c)
        .join('')
    }

    if (color.length === 6) {
      const r = parseInt(color.substr(0, 2), 16)
      const g = parseInt(color.substr(2, 2), 16)
      const b = parseInt(color.substr(4, 2), 16)
      return { r, g, b }
    }

    return null
  }

  // Calculate contrast ratio
  private calculateContrastRatio(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number }
  ): number {
    const getLuminance = (color: { r: number; g: number; b: number }) => {
      const { r, g, b } = color
      const [rs, gs, bs] = [r, g, b].map((c) => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
    }

    const l1 = getLuminance(color1)
    const l2 = getLuminance(color2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)

    return (lighter + 0.05) / (darker + 0.05)
  }

  // Audit accessibility
  async auditAccessibility(): Promise<AccessibilityAudit> {
    const issues: AccessibilityIssue[] = []

    // Check color contrast
    issues.push(...this.auditColorContrast())

    // Check keyboard navigation
    issues.push(...this.auditKeyboardNavigation())

    // Check screen reader support
    issues.push(...this.auditScreenReaderSupport())

    // Check focus management
    issues.push(...this.auditFocusManagement())

    // Check semantic HTML
    issues.push(...this.auditSemanticHTML())

    // Check ARIA attributes
    issues.push(...this.auditARIA())

    // Calculate score
    const score = this.calculateAccessibilityScore(issues)

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues)

    // Calculate compliance
    const compliance = this.calculateCompliance(issues)

    return {
      score,
      issues,
      recommendations,
      compliance,
    }
  }

  // Audit color contrast
  private auditColorContrast(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    // Check common color combinations
    const colorPairs = [
      { fg: '#000000', bg: '#ffffff', element: 'text' },
      { fg: '#666666', bg: '#ffffff', element: 'text' },
      { fg: '#999999', bg: '#ffffff', element: 'text' },
      { fg: '#ffffff', bg: '#000000', element: 'text' },
      { fg: '#ffffff', bg: '#666666', element: 'text' },
    ]

    colorPairs.forEach(({ fg, bg, element }) => {
      const result = this.checkColorContrast(fg, bg)
      if (!result.isPassing) {
        issues.push({
          id: `contrast-${fg}-${bg}`,
          type: 'error',
          severity: 'high',
          category: 'contrast',
          message: `Insufficient color contrast ratio: ${result.ratio.toFixed(2)}`,
          element,
          suggestion: `Increase contrast ratio to at least 4.5:1 for AA compliance`,
          wcagCriteria: ['1.4.3'],
        })
      }
    })

    return issues
  }

  // Audit keyboard navigation
  private auditKeyboardNavigation(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return issues
    }

    // Check for interactive elements without tabindex
    const interactiveElements = document.querySelectorAll(
      'button, a, input, select, textarea'
    )

    interactiveElements.forEach((element) => {
      const tabIndex = element.getAttribute('tabindex')
      if (tabIndex === '-1' && !element.hasAttribute('aria-hidden')) {
        issues.push({
          id: `keyboard-${element.tagName.toLowerCase()}`,
          type: 'warning',
          severity: 'medium',
          category: 'keyboard',
          message: 'Interactive element is not keyboard accessible',
          element: element.tagName.toLowerCase(),
          suggestion: 'Remove tabindex="-1" or add proper keyboard handling',
          wcagCriteria: ['2.1.1', '2.1.2'],
        })
      }
    })

    return issues
  }

  // Audit screen reader support
  private auditScreenReaderSupport(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return issues
    }

    // Check for images without alt text
    const images = document.querySelectorAll('img')
    images.forEach((img) => {
      if (!img.getAttribute('alt') && !img.getAttribute('aria-label')) {
        issues.push({
          id: `sr-image-${images.length}`,
          type: 'error',
          severity: 'high',
          category: 'screen-reader',
          message: 'Image missing alt text',
          element: 'img',
          suggestion: 'Add descriptive alt text or aria-label',
          wcagCriteria: ['1.1.1'],
        })
      }
    })

    // Check for form labels
    const inputs = document.querySelectorAll('input, select, textarea')
    inputs.forEach((input) => {
      const id = input.getAttribute('id')
      const label = id ? document.querySelector(`label[for="${id}"]`) : null
      const ariaLabel = input.getAttribute('aria-label')
      const ariaLabelledBy = input.getAttribute('aria-labelledby')

      if (!label && !ariaLabel && !ariaLabelledBy) {
        issues.push({
          id: `sr-input-${inputs.length}`,
          type: 'error',
          severity: 'high',
          category: 'screen-reader',
          message: 'Form input missing label',
          element: input.tagName.toLowerCase(),
          suggestion: 'Add label, aria-label, or aria-labelledby',
          wcagCriteria: ['1.3.1', '3.3.2'],
        })
      }
    })

    return issues
  }

  // Audit focus management
  private auditFocusManagement(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return issues
    }

    // Check for focus indicators
    const focusableElements = document.querySelectorAll(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    focusableElements.forEach((element) => {
      const computedStyle = getComputedStyle(element)
      const outline = computedStyle.outline
      const outlineWidth = computedStyle.outlineWidth

      if (outline === 'none' && outlineWidth === '0px') {
        issues.push({
          id: `focus-${element.tagName.toLowerCase()}`,
          type: 'warning',
          severity: 'medium',
          category: 'focus',
          message: 'Focus indicator not visible',
          element: element.tagName.toLowerCase(),
          suggestion: 'Add visible focus indicator',
          wcagCriteria: ['2.4.7'],
        })
      }
    })

    return issues
  }

  // Audit semantic HTML
  private auditSemanticHTML(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return issues
    }

    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6')
    let previousLevel = 0

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1))
      if (level > previousLevel + 1) {
        issues.push({
          id: `semantic-heading-${level}`,
          type: 'warning',
          severity: 'medium',
          category: 'semantics',
          message: 'Heading hierarchy skipped',
          element: heading.tagName.toLowerCase(),
          suggestion: 'Use proper heading hierarchy (h1, h2, h3, etc.)',
          wcagCriteria: ['1.3.1'],
        })
      }
      previousLevel = level
    })

    return issues
  }

  // Audit ARIA attributes
  private auditARIA(): AccessibilityIssue[] {
    const issues: AccessibilityIssue[] = []

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return issues
    }

    // Check for ARIA labels without corresponding elements
    const ariaLabels = document.querySelectorAll('[aria-label]')
    ariaLabels.forEach((element) => {
      const ariaLabel = element.getAttribute('aria-label')
      if (!ariaLabel || ariaLabel.trim() === '') {
        issues.push({
          id: `aria-label-${ariaLabels.length}`,
          type: 'error',
          severity: 'medium',
          category: 'aria',
          message: 'Empty aria-label',
          element: element.tagName.toLowerCase(),
          suggestion: 'Provide meaningful aria-label text',
          wcagCriteria: ['4.1.2'],
        })
      }
    })

    return issues
  }

  // Calculate accessibility score
  private calculateAccessibilityScore(issues: AccessibilityIssue[]): number {
    let score = 100

    issues.forEach((issue) => {
      switch (issue.severity) {
        case 'critical':
          score -= 20
          break
        case 'high':
          score -= 15
          break
        case 'medium':
          score -= 10
          break
        case 'low':
          score -= 5
          break
      }
    })

    return Math.max(0, score)
  }

  // Generate recommendations
  private generateRecommendations(issues: AccessibilityIssue[]): string[] {
    const recommendations: string[] = []

    const categories = new Set(issues.map((issue) => issue.category))

    if (categories.has('contrast')) {
      recommendations.push(
        'Improve color contrast ratios to meet WCAG AA standards'
      )
    }

    if (categories.has('keyboard')) {
      recommendations.push(
        'Ensure all interactive elements are keyboard accessible'
      )
    }

    if (categories.has('screen-reader')) {
      recommendations.push('Add proper labels and alt text for screen readers')
    }

    if (categories.has('focus')) {
      recommendations.push('Implement visible focus indicators')
    }

    if (categories.has('semantics')) {
      recommendations.push(
        'Use semantic HTML elements and proper heading hierarchy'
      )
    }

    if (categories.has('aria')) {
      recommendations.push(
        'Add appropriate ARIA attributes for complex interactions'
      )
    }

    return recommendations
  }

  // Calculate compliance percentage
  private calculateCompliance(issues: AccessibilityIssue[]): {
    level: 'A' | 'AA' | 'AAA'
    percentage: number
  } {
    const totalChecks = 50 // Total number of WCAG checks
    const passingChecks = totalChecks - issues.length
    const percentage = (passingChecks / totalChecks) * 100

    let level: 'A' | 'AA' | 'AAA'
    if (percentage >= 95) {
      level = 'AAA'
    } else if (percentage >= 85) {
      level = 'AA'
    } else {
      level = 'A'
    }

    return { level, percentage }
  }

  // Announce to screen readers
  announce(message: string): void {
    if (
      typeof window !== 'undefined' &&
      (window as any).announceToScreenReader
    ) {
      ;(window as any).announceToScreenReader(message)
    }
  }

  // Get accessibility issues
  getIssues(): AccessibilityIssue[] {
    return this.issues
  }

  // Clear issues
  clearIssues(): void {
    this.issues = []
  }
}

// Global accessibility manager instance
export const accessibilityManager = AccessibilityManager.getInstance()

// Utility functions
export function checkColorContrast(
  foreground: string,
  background: string
): ColorContrastResult {
  return accessibilityManager.checkColorContrast(foreground, background)
}

export function auditAccessibility(): Promise<AccessibilityAudit> {
  return accessibilityManager.auditAccessibility()
}

export function announceToScreenReader(message: string): void {
  return accessibilityManager.announce(message)
}

export function getAccessibilityIssues(): AccessibilityIssue[] {
  return accessibilityManager.getIssues()
}

export function clearAccessibilityIssues(): void {
  return accessibilityManager.clearIssues()
}

// React hook for accessibility
export function useAccessibility() {
  return {
    checkColorContrast,
    auditAccessibility,
    announceToScreenReader,
    getAccessibilityIssues,
    clearAccessibilityIssues,
  }
}

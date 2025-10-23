'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import {
  detectSwipe,
  getTouchDimensions,
  getViewportInfo,
} from '@/lib/mobile-utils'
import { cn } from '@/lib/utils'

interface MobileTouchProps {
  children: ReactNode
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void
  onTap?: () => void
  onLongPress?: () => void
  onPinch?: (scale: number) => void
  className?: string
  disabled?: boolean
  hapticFeedback?: boolean
  style?: React.CSSProperties
}

export function MobileTouch({
  children,
  onSwipe,
  onTap,
  onLongPress,
  onPinch,
  className,
  disabled = false,
  hapticFeedback = true,
  style,
}: MobileTouchProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [isLongPressing, setIsLongPressing] = useState(false)
  const touchRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const viewportInfo = getViewportInfo()
  const touchDimensions = getTouchDimensions()

  // Haptic feedback
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !viewportInfo.touchSupport) return

    try {
      // @ts-ignore - Haptic feedback API
      if (navigator.vibrate) {
        const patterns = {
          light: [10],
          medium: [20],
          heavy: [30],
        }
        navigator.vibrate(patterns[type])
      }
    } catch (error) {
      // Silently fail if haptic feedback is not supported
    }
  }

  // Long press detection
  useEffect(() => {
    if (!touchRef.current || disabled) return

    const element = touchRef.current

    const handleTouchStart = (e: TouchEvent) => {
      if (disabled) return

      setIsPressed(true)
      triggerHaptic('light')

      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        setIsLongPressing(true)
        onLongPress?.()
        triggerHaptic('medium')
      }, 500)
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (disabled) return

      setIsPressed(false)
      setIsLongPressing(false)

      // Clear long press timer
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      // Trigger tap if not long press
      if (!isLongPressing) {
        onTap?.()
        triggerHaptic('light')
      }
    }

    const handleTouchCancel = () => {
      setIsPressed(false)
      setIsLongPressing(false)

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })
    element.addEventListener('touchcancel', handleTouchCancel, {
      passive: true,
    })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchCancel)

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
      }
    }
  }, [disabled, onTap, onLongPress, isLongPressing, triggerHaptic])

  // Swipe detection
  useEffect(() => {
    if (!touchRef.current || !onSwipe || disabled) return

    const element = touchRef.current

    const cleanup = detectSwipe(
      element,
      (swipe) => {
        if (swipe.direction !== 'none') {
          onSwipe(swipe.direction)
          triggerHaptic('medium')
        }
      },
      {
        threshold: 50,
        velocityThreshold: 0.3,
        preventDefault: false,
      }
    )

    return cleanup
  }, [onSwipe, disabled, triggerHaptic])

  // Pinch detection
  useEffect(() => {
    if (!touchRef.current || !onPinch || disabled) return

    const element = touchRef.current
    let initialDistance = 0

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        initialDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        )
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const currentDistance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
            Math.pow(touch2.clientY - touch1.clientY, 2)
        )

        const scale = currentDistance / initialDistance
        onPinch(scale)
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
    }
  }, [onPinch, disabled])

  return (
    <div
      ref={touchRef}
      className={cn(
        'touch-manipulation select-none',
        isPressed && 'scale-95 transition-transform duration-100',
        isLongPressing && 'scale-90',
        className
      )}
      style={{
        minHeight: touchDimensions.minTouchTarget,
        minWidth: touchDimensions.minTouchTarget,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// Mobile-optimized button component
interface MobileButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  className?: string
  hapticFeedback?: boolean
}

export function MobileButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className,
  hapticFeedback = true,
}: MobileButtonProps) {
  const viewportInfo = getViewportInfo()
  const touchDimensions = getTouchDimensions()

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary text-primary-foreground hover:bg-primary/90'
      case 'secondary':
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      case 'outline':
        return 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
      case 'ghost':
        return 'hover:bg-accent hover:text-accent-foreground'
      default:
        return 'bg-primary text-primary-foreground hover:bg-primary/90'
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return viewportInfo.isMobile ? 'h-8 px-3 text-sm' : 'h-9 px-3 text-sm'
      case 'lg':
        return viewportInfo.isMobile
          ? 'h-12 px-6 text-lg'
          : 'h-11 px-8 text-base'
      default:
        return viewportInfo.isMobile
          ? 'h-10 px-4 text-base'
          : 'h-10 px-4 text-sm'
    }
  }

  return (
    <MobileTouch
      onTap={onClick}
      disabled={disabled || loading}
      hapticFeedback={hapticFeedback}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        getVariantClasses(),
        getSizeClasses(),
        className
      )}
      style={{
        minHeight: touchDimensions.recommendedTouchTarget,
        minWidth: touchDimensions.recommendedTouchTarget,
      }}
    >
      {loading ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      ) : (
        children
      )}
    </MobileTouch>
  )
}

// Mobile-optimized input component
interface MobileInputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url'
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  error?: string
  className?: string
  inputMode?: 'text' | 'email' | 'numeric' | 'tel' | 'url'
  autoComplete?: string
}

export function MobileInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error,
  className,
  inputMode,
  autoComplete,
}: MobileInputProps) {
  const viewportInfo = getViewportInfo()
  const touchDimensions = getTouchDimensions()

  const getInputMode = () => {
    if (inputMode) return inputMode

    switch (type) {
      case 'email':
        return 'email'
      case 'number':
        return 'numeric'
      case 'tel':
        return 'tel'
      case 'url':
        return 'url'
      default:
        return 'text'
    }
  }

  return (
    <div className="space-y-1">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        inputMode={getInputMode()}
        autoComplete={autoComplete}
        className={cn(
          'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          viewportInfo.isMobile ? 'h-12 text-base' : 'h-10 text-sm',
          error && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        style={{
          minHeight: touchDimensions.recommendedTouchTarget,
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

// Mobile-optimized card component
interface MobileCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  disabled?: boolean
  hapticFeedback?: boolean
}

export function MobileCard({
  children,
  className,
  onClick,
  disabled = false,
  hapticFeedback = true,
}: MobileCardProps) {
  const viewportInfo = getViewportInfo()
  const touchDimensions = getTouchDimensions()

  return (
    <MobileTouch
      onTap={onClick}
      disabled={disabled}
      hapticFeedback={hapticFeedback}
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm transition-colors',
        onClick &&
          'cursor-pointer hover:bg-accent hover:text-accent-foreground',
        viewportInfo.isMobile ? 'p-4' : 'p-6',
        className
      )}
      style={{
        minHeight: touchDimensions.recommendedTouchTarget,
      }}
    >
      {children}
    </MobileTouch>
  )
}

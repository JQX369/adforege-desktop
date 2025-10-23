'use client'

import { ReactNode, useEffect, useState } from 'react'
import {
  getViewportInfo,
  getSafeAreaInsets,
  getTouchDimensions,
} from '@/lib/mobile-utils'
import { cn } from '@/lib/utils'

interface MobileLayoutProps {
  children: ReactNode
  className?: string
  header?: ReactNode
  footer?: ReactNode
  sidebar?: ReactNode
  showSidebar?: boolean
  onSidebarToggle?: () => void
}

export function MobileLayout({
  children,
  className,
  header,
  footer,
  sidebar,
  showSidebar = false,
  onSidebarToggle,
}: MobileLayoutProps) {
  const [viewportInfo, setViewportInfo] = useState(getViewportInfo())
  const [safeAreaInsets, setSafeAreaInsets] = useState(getSafeAreaInsets())
  const [touchDimensions, setTouchDimensions] = useState(getTouchDimensions())

  useEffect(() => {
    const updateViewport = () => {
      setViewportInfo(getViewportInfo())
      setSafeAreaInsets(getSafeAreaInsets())
      setTouchDimensions(getTouchDimensions())
    }

    updateViewport()

    window.addEventListener('resize', updateViewport)
    window.addEventListener('orientationchange', updateViewport)

    return () => {
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('orientationchange', updateViewport)
    }
  }, [])

  return (
    <div
      className={cn('min-h-screen bg-background', className)}
      style={{
        paddingTop: safeAreaInsets.top,
        paddingBottom: safeAreaInsets.bottom,
        paddingLeft: safeAreaInsets.left,
        paddingRight: safeAreaInsets.right,
      }}
    >
      {/* Header */}
      {header && (
        <header
          className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          style={{
            paddingTop: safeAreaInsets.top > 0 ? 0 : '1rem',
            paddingBottom: '1rem',
          }}
        >
          {header}
        </header>
      )}

      {/* Main content area */}
      <div className="flex flex-1">
        {/* Sidebar */}
        {sidebar && viewportInfo.isDesktop && (
          <aside
            className={cn(
              'hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:z-50',
              showSidebar && 'lg:translate-x-0'
            )}
          >
            {sidebar}
          </aside>
        )}

        {/* Mobile sidebar overlay */}
        {sidebar && viewportInfo.isMobile && showSidebar && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={onSidebarToggle}
            />
            <div className="fixed inset-y-0 left-0 w-64 bg-background border-r">
              {sidebar}
            </div>
          </div>
        )}

        {/* Main content */}
        <main
          className={cn(
            'flex-1',
            viewportInfo.isDesktop && sidebar && 'lg:pl-64'
          )}
        >
          <div
            className={cn(
              'container mx-auto',
              viewportInfo.isMobile ? 'px-4' : 'px-6'
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <footer
          className="border-t bg-background"
          style={{
            paddingBottom: safeAreaInsets.bottom > 0 ? 0 : '1rem',
          }}
        >
          {footer}
        </footer>
      )}
    </div>
  )
}

// Mobile-optimized container component
interface MobileContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function MobileContainer({
  children,
  className,
  maxWidth = 'lg',
  padding = 'md',
}: MobileContainerProps) {
  const viewportInfo = getViewportInfo()

  const getMaxWidthClass = () => {
    switch (maxWidth) {
      case 'sm':
        return 'max-w-sm'
      case 'md':
        return 'max-w-md'
      case 'lg':
        return 'max-w-lg'
      case 'xl':
        return 'max-w-xl'
      case '2xl':
        return 'max-w-2xl'
      case 'full':
        return 'max-w-full'
      default:
        return 'max-w-lg'
    }
  }

  const getPaddingClass = () => {
    switch (padding) {
      case 'none':
        return 'p-0'
      case 'sm':
        return viewportInfo.isMobile ? 'p-2' : 'p-4'
      case 'lg':
        return viewportInfo.isMobile ? 'p-6' : 'p-8'
      default:
        return viewportInfo.isMobile ? 'p-4' : 'p-6'
    }
  }

  return (
    <div
      className={cn(
        'mx-auto',
        getMaxWidthClass(),
        getPaddingClass(),
        className
      )}
    >
      {children}
    </div>
  )
}

// Mobile-optimized grid component
interface MobileGridProps {
  children: ReactNode
  className?: string
  cols?: 1 | 2 | 3 | 4 | 6 | 12
  gap?: 'sm' | 'md' | 'lg'
  responsive?: boolean
}

export function MobileGrid({
  children,
  className,
  cols = 1,
  gap = 'md',
  responsive = true,
}: MobileGridProps) {
  const viewportInfo = getViewportInfo()

  const getColsClass = () => {
    if (!responsive) {
      return `grid-cols-${cols}`
    }

    // Responsive grid columns
    if (viewportInfo.isMobile) {
      return 'grid-cols-1'
    } else if (viewportInfo.isTablet) {
      return cols >= 2 ? 'grid-cols-2' : 'grid-cols-1'
    } else {
      return `grid-cols-${Math.min(cols, 4)}`
    }
  }

  const getGapClass = () => {
    switch (gap) {
      case 'sm':
        return viewportInfo.isMobile ? 'gap-2' : 'gap-3'
      case 'lg':
        return viewportInfo.isMobile ? 'gap-6' : 'gap-8'
      default:
        return viewportInfo.isMobile ? 'gap-4' : 'gap-6'
    }
  }

  return (
    <div className={cn('grid', getColsClass(), getGapClass(), className)}>
      {children}
    </div>
  )
}

// Mobile-optimized stack component
interface MobileStackProps {
  children: ReactNode
  className?: string
  direction?: 'row' | 'column'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  gap?: 'sm' | 'md' | 'lg'
  wrap?: boolean
  responsive?: boolean
}

export function MobileStack({
  children,
  className,
  direction = 'column',
  align = 'stretch',
  justify = 'start',
  gap = 'md',
  wrap = false,
  responsive = true,
}: MobileStackProps) {
  const viewportInfo = getViewportInfo()

  const getDirectionClass = () => {
    if (!responsive) {
      return direction === 'row' ? 'flex-row' : 'flex-col'
    }

    // Responsive direction
    if (viewportInfo.isMobile) {
      return 'flex-col'
    } else {
      return direction === 'row' ? 'flex-row' : 'flex-col'
    }
  }

  const getAlignClass = () => {
    switch (align) {
      case 'start':
        return 'items-start'
      case 'center':
        return 'items-center'
      case 'end':
        return 'items-end'
      case 'stretch':
        return 'items-stretch'
      default:
        return 'items-stretch'
    }
  }

  const getJustifyClass = () => {
    switch (justify) {
      case 'start':
        return 'justify-start'
      case 'center':
        return 'justify-center'
      case 'end':
        return 'justify-end'
      case 'between':
        return 'justify-between'
      case 'around':
        return 'justify-around'
      case 'evenly':
        return 'justify-evenly'
      default:
        return 'justify-start'
    }
  }

  const getGapClass = () => {
    switch (gap) {
      case 'sm':
        return viewportInfo.isMobile ? 'gap-2' : 'gap-3'
      case 'lg':
        return viewportInfo.isMobile ? 'gap-6' : 'gap-8'
      default:
        return viewportInfo.isMobile ? 'gap-4' : 'gap-6'
    }
  }

  return (
    <div
      className={cn(
        'flex',
        getDirectionClass(),
        getAlignClass(),
        getJustifyClass(),
        getGapClass(),
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </div>
  )
}

// Mobile-optimized text component
interface MobileTextProps {
  children: ReactNode
  className?: string
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  weight?: 'light' | 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'default' | 'muted' | 'primary' | 'secondary' | 'destructive'
  align?: 'left' | 'center' | 'right' | 'justify'
  responsive?: boolean
}

export function MobileText({
  children,
  className,
  size = 'base',
  weight = 'normal',
  color = 'default',
  align = 'left',
  responsive = true,
}: MobileTextProps) {
  const viewportInfo = getViewportInfo()

  const getSizeClass = () => {
    if (!responsive) {
      return `text-${size}`
    }

    // Responsive text sizes
    switch (size) {
      case 'xs':
        return viewportInfo.isMobile ? 'text-xs' : 'text-sm'
      case 'sm':
        return viewportInfo.isMobile ? 'text-sm' : 'text-base'
      case 'base':
        return viewportInfo.isMobile ? 'text-base' : 'text-lg'
      case 'lg':
        return viewportInfo.isMobile ? 'text-lg' : 'text-xl'
      case 'xl':
        return viewportInfo.isMobile ? 'text-xl' : 'text-2xl'
      case '2xl':
        return viewportInfo.isMobile ? 'text-2xl' : 'text-3xl'
      case '3xl':
        return viewportInfo.isMobile ? 'text-3xl' : 'text-4xl'
      case '4xl':
        return viewportInfo.isMobile ? 'text-4xl' : 'text-5xl'
      default:
        return 'text-base'
    }
  }

  const getWeightClass = () => {
    switch (weight) {
      case 'light':
        return 'font-light'
      case 'normal':
        return 'font-normal'
      case 'medium':
        return 'font-medium'
      case 'semibold':
        return 'font-semibold'
      case 'bold':
        return 'font-bold'
      default:
        return 'font-normal'
    }
  }

  const getColorClass = () => {
    switch (color) {
      case 'muted':
        return 'text-muted-foreground'
      case 'primary':
        return 'text-primary'
      case 'secondary':
        return 'text-secondary-foreground'
      case 'destructive':
        return 'text-destructive'
      default:
        return 'text-foreground'
    }
  }

  const getAlignClass = () => {
    switch (align) {
      case 'center':
        return 'text-center'
      case 'right':
        return 'text-right'
      case 'justify':
        return 'text-justify'
      default:
        return 'text-left'
    }
  }

  return (
    <div
      className={cn(
        getSizeClass(),
        getWeightClass(),
        getColorClass(),
        getAlignClass(),
        className
      )}
    >
      {children}
    </div>
  )
}

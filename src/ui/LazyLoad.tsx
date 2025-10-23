'use client'

import { useEffect, useRef, useState, ReactNode } from 'react'

interface LazyLoadProps {
  children: ReactNode
  threshold?: number
  rootMargin?: string
  fallback?: ReactNode
  className?: string
}

export function LazyLoad({
  children,
  threshold = 0.1,
  rootMargin = '50px',
  fallback,
  className,
}: LazyLoadProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true)
          setHasLoaded(true)
          observer.disconnect()
        }
      },
      {
        threshold,
        rootMargin,
      }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [threshold, rootMargin, hasLoaded])

  return (
    <div ref={ref} className={className}>
      {isVisible ? children : fallback}
    </div>
  )
}

// Specialized lazy loading components
export function LazyImage({
  src,
  alt,
  className,
  ...props
}: {
  src: string
  alt: string
  className?: string
  [key: string]: any
}) {
  return (
    <LazyLoad
      fallback={
        <div className={`bg-muted animate-pulse ${className}`}>
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Loading...
          </div>
        </div>
      }
    >
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        {...props}
      />
    </LazyLoad>
  )
}

export function LazySection({
  children,
  className,
  ...props
}: {
  children: ReactNode
  className?: string
  [key: string]: any
}) {
  return (
    <LazyLoad
      className={className}
      fallback={
        <div className={`bg-muted animate-pulse ${className}`}>
          <div className="w-full h-32 flex items-center justify-center text-muted-foreground">
            Loading content...
          </div>
        </div>
      }
      {...props}
    >
      {children}
    </LazyLoad>
  )
}

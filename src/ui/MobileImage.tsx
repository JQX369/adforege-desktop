'use client'

import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'
import {
  getOptimizedImageSrc,
  getViewportInfo,
  getLazyLoadingConfig,
} from '@/lib/mobile-utils'
import { cn } from '@/lib/utils'

interface MobileImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  quality?: number
  fill?: boolean
  sizes?: string
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
  onSwipe?: (direction: 'left' | 'right') => void
}

export function MobileImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 80,
  fill = false,
  sizes,
  placeholder = 'blur',
  blurDataURL,
  onLoad,
  onError,
  onSwipe,
}: MobileImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isInView, setIsInView] = useState(priority)
  const [hasError, setHasError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)
  const viewportInfo = getViewportInfo()
  const lazyConfig = getLazyLoadingConfig()

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        rootMargin: lazyConfig.rootMargin,
        threshold: lazyConfig.threshold,
      }
    )

    observer.observe(imgRef.current)

    return () => observer.disconnect()
  }, [priority, lazyConfig])

  // Generate optimized src based on viewport
  const optimizedSrc = getOptimizedImageSrc(src, {
    width: width || (viewportInfo.isMobile ? 400 : 800),
    height: height || (viewportInfo.isMobile ? 300 : 600),
    quality,
    format: 'webp',
  })

  // Generate responsive sizes
  const responsiveSizes =
    sizes ||
    (viewportInfo.isMobile
      ? '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
      : '(max-width: 1200px) 50vw, 33vw')

  // Generate blur placeholder
  const defaultBlurDataURL =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

  const handleLoad = () => {
    setIsLoaded(true)
    onLoad?.()
  }

  const handleError = () => {
    setHasError(true)
    onError?.()
  }

  if (hasError) {
    return (
      <div
        ref={imgRef}
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-sm">Failed to load image</span>
      </div>
    )
  }

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden', className)}>
      {isInView && (
        <Image
          src={optimizedSrc}
          alt={alt}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          fill={fill}
          priority={priority}
          quality={quality}
          sizes={responsiveSizes}
          placeholder={placeholder}
          blurDataURL={blurDataURL || defaultBlurDataURL}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            objectFit: 'cover',
          }}
        />
      )}

      {/* Loading placeholder */}
      {!isLoaded && isInView && (
        <div
          className="absolute inset-0 bg-muted animate-pulse"
          style={{ width, height }}
        />
      )}
    </div>
  )
}

// Mobile-optimized image gallery component
interface MobileImageGalleryProps {
  images: Array<{
    src: string
    alt: string
    width?: number
    height?: number
  }>
  className?: string
  aspectRatio?: 'square' | 'video' | 'portrait'
}

export function MobileImageGallery({
  images,
  className,
  aspectRatio = 'square',
}: MobileImageGalleryProps) {
  const viewportInfo = getViewportInfo()
  const [currentIndex, setCurrentIndex] = useState(0)

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'video':
        return 'aspect-video'
      case 'portrait':
        return 'aspect-[3/4]'
      default:
        return 'aspect-square'
    }
  }

  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else if (direction === 'right' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  return (
    <div className={cn('relative', className)}>
      {/* Main image */}
      <div
        className={cn(
          'relative overflow-hidden rounded-lg',
          getAspectRatioClass()
        )}
      >
        <MobileImage
          src={images[currentIndex].src}
          alt={images[currentIndex].alt}
          fill
          className="object-cover"
          onSwipe={handleSwipe}
        />

        {/* Navigation dots */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && viewportInfo.isDesktop && (
        <div className="flex space-x-2 mt-4 overflow-x-auto">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-colors',
                index === currentIndex ? 'border-primary' : 'border-transparent'
              )}
            >
              <MobileImage
                src={image.src}
                alt={image.alt}
                width={64}
                height={64}
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Mobile-optimized video component
interface MobileVideoProps {
  src: string
  poster?: string
  className?: string
  autoplay?: boolean
  muted?: boolean
  loop?: boolean
  controls?: boolean
  aspectRatio?: 'square' | 'video' | 'portrait'
}

export function MobileVideo({
  src,
  poster,
  className,
  autoplay = false,
  muted = true,
  loop = false,
  controls = true,
  aspectRatio = 'video',
}: MobileVideoProps) {
  const viewportInfo = getViewportInfo()
  const [isLoaded, setIsLoaded] = useState(false)

  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square'
      case 'portrait':
        return 'aspect-[3/4]'
      default:
        return 'aspect-video'
    }
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg',
        getAspectRatioClass(),
        className
      )}
    >
      <video
        src={src}
        poster={poster}
        autoPlay={autoplay && viewportInfo.isMobile}
        muted={muted}
        loop={loop}
        controls={controls}
        playsInline
        onLoadedData={() => setIsLoaded(true)}
        className="w-full h-full object-cover"
      />

      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <span className="text-muted-foreground">Loading video...</span>
        </div>
      )}
    </div>
  )
}

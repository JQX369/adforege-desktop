'use client'

import React, { useState, useRef, useMemo, useEffect } from 'react'
import TinderCard from 'react-tinder-card'
import { ProductCard } from './ProductCard'
import { Button } from '@/components/ui/button'
import { Heart, X } from 'lucide-react'

export interface Product {
  id: string
  title: string
  description: string
  price: number
  imageUrl: string
  affiliateUrl: string
  matchScore: number
  categories: string[]
}

interface SwipeDeckProps {
  products: Product[]
  onSwipe: (productId: string, action: 'LEFT' | 'RIGHT' | 'SAVED') => Promise<void>
  userId: string
  sessionId: string
  onLoadMore?: () => void
  hasMore?: boolean
}

type SwipeDirection = 'left' | 'right' | 'up' | 'down'

export function SwipeDeck({ products, onSwipe, userId, sessionId, onLoadMore, hasMore }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(products.length - 1)
  const [isLoading, setIsLoading] = useState(false)
  const [hideMap, setHideMap] = useState<Record<string, boolean>>({})
  const prefetchRequestedRef = useRef(false)
  
  // References for programmatic swipes
  const currentIndexRef = useRef(currentIndex)
  const childRefs = useMemo(
    () =>
      Array(products.length)
        .fill(0)
        .map(() => React.createRef<any>()),
    [products.length]
  )

  const updateCurrentIndex = (val: number) => {
    setCurrentIndex(val)
    currentIndexRef.current = val
  }

  const canSwipe = currentIndex >= 0

  // Prefetch next page when nearing the end of the stack
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    if (prefetchRequestedRef.current) return
    if (currentIndex <= 6) {
      prefetchRequestedRef.current = true
      onLoadMore()
    }
  }, [currentIndex, hasMore, onLoadMore])

  const swiped = async (direction: SwipeDirection, productId: string, index: number) => {
    updateCurrentIndex(index - 1)
    
    setIsLoading(true)
    try {
      let action: 'LEFT' | 'RIGHT' | 'SAVED'
      if (direction === 'left') {
        action = 'LEFT'
      } else if (direction === 'right') {
        action = 'RIGHT'
      } else if (direction === 'up') {
        // disable up-swipe: ignore
        return
      } else {
        return // Ignore down swipes
      }
      
      await onSwipe(productId, action)
      
      // Auto-save on right swipe
      if (action === 'RIGHT') {
        await onSwipe(productId, 'SAVED')
      }
      setHideMap(prev => ({ ...prev, [productId]: true }))
    } catch (error) {
      console.error('Error recording swipe:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const outOfFrame = (name: string, idx: number) => {}

  const swipe = async (dir: SwipeDirection) => {
    if (canSwipe && currentIndex < products.length) {
      await childRefs[currentIndex].current.swipe(dir)
    }
  }

  // Swipe button handlers
  const handleDislike = () => swipe('left')
  const handleLike = () => swipe('right')
  const handleSave = () => swipe('up')

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      <div className="relative h-[600px] w-full glass-panel rounded-xl">
        {products.map((product, index) => {
          const isTop = index === currentIndex
          const belowBy = currentIndex - index
          const stackClass = !isTop
            ? belowBy === 1
              ? 'scale-95 translate-y-2 opacity-95'
              : belowBy === 2
              ? 'scale-90 translate-y-4 opacity-90'
              : 'scale-90 translate-y-8 opacity-80'
            : 'scale-100'
          const hidden = hideMap[product.id]
          return (
          <TinderCard
            ref={childRefs[index]}
            key={product.id}
            onSwipe={(dir) => swiped(dir as SwipeDirection, product.id, index)}
            onCardLeftScreen={() => outOfFrame(product.title, index)}
            preventSwipe={['down','up']}
            swipeRequirementType="velocity"
            swipeThreshold={0.18}
            flickOnSwipe={true}
            className={`absolute w-full h-full ${stackClass} ${hidden ? 'hidden' : ''} ${isTop ? 'z-30' : 'z-10'} will-change-transform`}
          >
            <div className={`relative h-full ${!isTop ? 'pointer-events-none' : ''}`}>
              {/* Product */}
              <ProductCard product={product} />
              {/* Gradient overlay - red for left, gold for right; controlled by CSS classes applied by tinder-card */}
              <div className="absolute inset-0 opacity-0 transition-opacity duration-100 gradient-left pointer-events-none" />
              <div className="absolute inset-0 opacity-0 transition-opacity duration-100 gradient-right pointer-events-none" />
            </div>
          </TinderCard>
          )
        })}
        
        {currentIndex < 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">No more recommendations!</h3>
              <p className="text-muted-foreground mb-4">Check your saved items or try a new search.</p>
              {hasMore && onLoadMore && (
                <Button
                  onClick={onLoadMore}
                  size="lg"
                  className="mt-4"
                >
                  Load More Recommendations
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-4 mt-8">
        <Button
          size="lg"
          variant="outline"
          className="rounded-full w-16 h-16 p-0"
          onClick={handleDislike}
          disabled={!canSwipe || isLoading}
        >
          <X className="w-8 h-8 text-red-500" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="rounded-full w-16 h-16 p-0"
          onClick={handleLike}
          disabled={!canSwipe || isLoading}
        >
          <Heart className="w-8 h-8 text-green-500" />
        </Button>
      </div>

      {/* Swipe tips */}
      <p className="mt-3 text-xs text-muted-foreground">
        Tip: Swipe left to pass, right to like/save
      </p>

      <style jsx>{`
        :global(.swipe-right) .gradient-right { opacity: 0.28; background: linear-gradient(90deg, rgba(255,215,0,0.35), rgba(255,215,0,0.0)); mix-blend-mode: multiply; }
        :global(.swipe-left) .gradient-left { opacity: 0.28; background: linear-gradient(270deg, rgba(239,68,68,0.35), rgba(239,68,68,0.0)); mix-blend-mode: multiply; }
      `}</style>
    </div>
  )
} 
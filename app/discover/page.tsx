'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { SwipeDeck, type Product as SwipeProduct } from '@/src/ui/components/SwipeDeck'

type QuizAnswers = {
  relationship: string
  occasion: string
  interests: string[]
  vibe: string
}

function mapRelationship(value: string): 'partner' | 'family' | 'friend' | 'colleague' | 'acquaintance' | 'other' {
  const v = value.toLowerCase()
  if (v === 'partner') return 'partner'
  if (v === 'friend') return 'friend'
  if (v === 'colleague') return 'colleague'
  if (v === 'parent' || v === 'sibling') return 'family'
  return 'other'
}

function mapOccasion(value: string):
  | 'birthday'
  | 'anniversary'
  | 'holiday'
  | 'graduation'
  | 'wedding'
  | 'baby-shower'
  | 'housewarming'
  | 'thank-you'
  | 'just-because'
  | 'other' {
  const v = value.toLowerCase()
  if (v.includes('birthday')) return 'birthday'
  if (v.includes('anniversary')) return 'anniversary'
  if (v.includes('holiday')) return 'holiday'
  if (v.includes('housewarming')) return 'housewarming'
  if (v.includes('thank')) return 'thank-you'
  if (v.includes('just')) return 'just-because'
  return 'other'
}

function mapBudget(vibe: string): 'under-25' | '25-50' | '50-100' | '100-200' | '200-500' | '500+' {
  if (vibe.startsWith('Under $50')) return '25-50'
  if (vibe.startsWith('$50-$100')) return '50-100'
  if (vibe.startsWith('$100+')) return '100-200'
  if (vibe.startsWith('Money')) return '500+'
  return '50-100'
}

export default function DiscoverPage() {
  const [products, setProducts] = useState<SwipeProduct[]>([])
  const [sessionId, setSessionId] = useState<string>('')
  const [page, setPage] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  async function fetchRecs(nextPage = 0) {
    setIsLoading(true)
    try {
      const saved = typeof window !== 'undefined' ? window.sessionStorage.getItem('quizAnswers') : null
      const qa: QuizAnswers | null = saved ? JSON.parse(saved) : null
      const payload = {
        formData: {
          occasion: qa ? mapOccasion(qa.occasion) : 'other',
          relationship: qa ? mapRelationship(qa.relationship) : 'other',
          gender: 'prefer-not-to-say',
          ageRange: '25-34',
          budget: qa ? mapBudget(qa.vibe) : '50-100',
          interests: qa?.interests ?? [],
        },
        userId: undefined,
        page: nextPage,
      }

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Failed to fetch recommendations: ${res.status}`)
      const data = await res.json()
      const recs: SwipeProduct[] = data.recommendations
      setProducts((prev) => (nextPage === 0 ? recs : [...prev, ...recs]))
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem('fw.lastRecs', JSON.stringify(recs))
        }
      } catch {}
      setSessionId(data.sessionId)
      setHasMore(Boolean(data.hasMore))
      setPage(data.page)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRecs(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onSwipe = async (productId: string, action: 'LEFT' | 'RIGHT' | 'SAVED') => {
    try {
      if (action === 'RIGHT' || action === 'SAVED') {
        const product = products.find((p) => p.id === productId)
        if (product) {
          // Lazy import to avoid SSR issues
          const { addSaved } = await import('@/src/features/saved/useSaved')
          addSaved({
            id: product.id,
            title: product.title,
            description: product.description,
            price: typeof product.price === 'number' ? product.price : Number(product.price) || undefined,
            imageUrl: product.imageUrl,
            affiliateUrl: product.affiliateUrl,
            savedAt: new Date().toISOString(),
          })
        }
      }
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            {
              event: 'swipe',
              properties: { productId, action },
              sessionId,
              page: '/discover',
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      })
    } catch {
      // ignore analytics failures
    }
  }

  const onLoadMore = () => fetchRecs(page + 1)

  if (isLoading && products.length === 0) {
    return (
      <main className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-muted-foreground">Finding great picks for you…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl py-6">
      <SwipeDeck
        products={products}
        onSwipe={onSwipe}
        userId=""
        sessionId={sessionId}
        hasMore={hasMore}
        onLoadMore={hasMore ? onLoadMore : undefined}
      />
    </main>
  )
}


